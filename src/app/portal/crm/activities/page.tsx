'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getCrmActivities, completeActivity, getFollowupDue, getStaffPeers } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import { CrmActivityDrawer } from '@/components/portal/CrmActivityDrawer';
import type { CrmActivityRow, CrmFollowupRow, StaffPeer } from '@/lib/portal-types';

type Bucket = 'overdue' | 'today' | 'upcoming' | 'done' | 'followup';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

function bucketOf(a: CrmActivityRow, now: Date): Bucket {
  if (a.done_at) return 'done';
  if (!a.due_at) return 'upcoming';
  const due = new Date(a.due_at);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  if (due < now) return 'overdue';
  if (due <= endOfToday) return 'today';
  return 'upcoming';
}

export default function CrmActivitiesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [rows, setRows] = useState<CrmActivityRow[]>([]);
  const [peers, setPeers] = useState<StaffPeer[]>([]);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState<Bucket>('today');
  const [followup, setFollowup] = useState<CrmFollowupRow[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace('/portal/login');
  }, [loading, session, router]);

  // Boss chốt 28/07/2026: CRM chỉ mở cho staff và admin
  useEffect(() => {
    if (!loading && profile && profile.role !== 'staff' && profile.role !== 'admin') {
      router.replace('/portal/403');
    }
  }, [loading, profile, router]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [acts, due] = await Promise.all([getCrmActivities(), getFollowupDue()]);
      // Danh bạ để đổi companion_id thành tên — view staff đọc được, khỏi đụng RLS profiles.
      void getStaffPeers().then(setPeers).catch(() => setPeers([]));
      setRows(acts);
      setFollowup(due);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const buckets = useMemo(() => {
    const now = new Date();
    const acc: Record<Bucket, CrmActivityRow[]> = { overdue: [], today: [], upcoming: [], done: [], followup: [] };
    rows.forEach(r => acc[bucketOf(r, now)].push(r));
    return acc;
  }, [rows]);

  const done = async (id: string) => {
    try {
      await completeActivity(id);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading || !profile) return null;

  const TABS: Bucket[] = ['overdue', 'today', 'upcoming', 'done', 'followup'];

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <CrmNav />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold text-[var(--crm-text)]">{t('portal.crm.activities.title')}</h1>
        <button onClick={() => setDrawerOpen(true)} className="flex items-center gap-2 rounded-xl bg-[#065f46] px-4 py-2 font-bold text-white">
          <span className="material-symbols-outlined text-[18px]">add_task</span>
          {t('portal.crm.activity.new')}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(b => (
          <button
            key={b}
            onClick={() => setTab(b)}
            className={`rounded-xl px-4 py-2 text-sm ${tab === b ? 'bg-[#065f46] text-white' : 'bg-[var(--crm-s3)] text-[var(--crm-muted)]'}`}
          >
            {t('portal.crm.activities.' + b)} ({b === 'followup' ? followup.length : buckets[b].length})
          </button>
        ))}
      </div>

      {busy && <p className="text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</p>}

      {tab === 'followup' && (
        <ul className="space-y-2">
          {followup.map(f => (
            <li key={f.id} className="flex items-start gap-3 rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s2)] p-4">
              <span className={`material-symbols-outlined text-[20px] ${f.reason === 'overdue' ? 'text-[#f87171]' : 'text-[#8bd6b6]'}`}>
                {f.reason === 'overdue' ? 'event_busy' : 'hourglass_empty'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--crm-text)]">
                  {f.name}
                  {f.code && <span className="ml-2 font-mono text-xs text-[var(--crm-muted)]">{f.code}</span>}
                </p>
                <p className="mt-1 text-xs text-[var(--crm-muted)]">
                  {f.account_name} · {f.stage_name} · {fmtVnd(Number(f.amount))}đ
                </p>
                <p className="mt-1 text-xs">
                  <span className={f.reason === 'overdue' ? 'text-[#f87171]' : 'text-[#8bd6b6]'}>
                    {t('portal.crm.followup.' + f.reason)}
                  </span>
                  <span className="text-[var(--crm-muted)]">
                    {' '}· {f.expected_close_date} · {f.days_idle} {t('portal.crm.followup.idle_days')}
                  </span>
                </p>
              </div>
              <Link
                href={`/portal/crm/accounts/detail?id=${f.account_id}`}
                className="rounded-xl border border-[var(--crm-line)] px-3 py-1.5 text-xs text-[var(--crm-text)] hover:border-[#8bd6b6]"
              >
                {t('portal.crm.detail.tab_overview')}
              </Link>
            </li>
          ))}
          {!busy && followup.length === 0 && (
            <li className="rounded-2xl border border-[var(--crm-line)] p-6 text-center text-sm text-[var(--crm-muted)]">
              {t('portal.crm.followup.empty')}
            </li>
          )}
        </ul>
      )}

      <ul className={`space-y-2 ${tab === 'followup' ? 'hidden' : ''}`}>
        {buckets[tab === 'followup' ? 'today' : tab].map(a => (
          <li key={a.id} className="flex items-start gap-3 rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s2)] p-4">
            <span className="material-symbols-outlined text-[20px] text-[#ffb77d]">
              {a.kind === 'call' ? 'call' : a.kind === 'meeting' ? 'event' : 'task_alt'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--crm-text)]">{a.subject}</p>
              <p className="mt-1 text-xs text-[var(--crm-muted)]">
                {a.account_name ?? a.opportunity_name ?? '—'}
                {a.due_at ? ` · ${new Date(a.due_at).toLocaleString('vi-VN')}` : ''}
              </p>
              {a.companion_id && (
                <p className="mt-1 text-xs text-[#8bd6b6]">
                  <span className="material-symbols-outlined mr-1 align-middle text-[14px]">group</span>
                  {t('portal.crm.activity.companion_pre')}{' '}
                  {peers.find(p => p.id === a.companion_id)?.full_name ?? '—'}
                </p>
              )}
              {a.notes && <p className="mt-2 text-xs text-[var(--crm-muted)]">{a.notes}</p>}
            </div>
            {!a.done_at && (
              <button
                onClick={() => void done(a.id)}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--crm-line)] px-3 py-1.5 text-xs text-[var(--crm-text)] hover:border-[#34d399]"
              >
                <span className="material-symbols-outlined text-[15px] text-[#34d399]">task_alt</span>
                {t('portal.crm.activity.mark_done')}
              </button>
            )}
          </li>
        ))}
        {!busy && tab !== 'followup' && buckets[tab].length === 0 && (
          <li className="rounded-2xl border border-[var(--crm-line)] p-6 text-center text-sm text-[var(--crm-muted)]">
            {t('portal.crm.activities.empty')}
          </li>
        )}
      </ul>

      <CrmActivityDrawer open={drawerOpen} ownerId={profile.id} onClose={() => setDrawerOpen(false)} onSaved={load} />
    </PortalShell>
  );
}
