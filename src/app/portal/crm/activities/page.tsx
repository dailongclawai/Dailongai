'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getCrmActivities, completeActivity } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import { CrmActivityDrawer } from '@/components/portal/CrmActivityDrawer';
import type { CrmActivityRow } from '@/lib/portal-types';

type Bucket = 'overdue' | 'today' | 'upcoming' | 'done';

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
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState<Bucket>('today');
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace('/portal/login');
  }, [loading, session, router]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setRows(await getCrmActivities());
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const buckets = useMemo(() => {
    const now = new Date();
    const acc: Record<Bucket, CrmActivityRow[]> = { overdue: [], today: [], upcoming: [], done: [] };
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

  const TABS: Bucket[] = ['overdue', 'today', 'upcoming', 'done'];

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <CrmNav />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold text-[#e2e2e5]">{t('portal.crm.activities.title')}</h1>
        <button onClick={() => setDrawerOpen(true)} className="rounded-xl bg-[#ff5625] px-4 py-2 font-bold text-white">
          {t('portal.crm.activity.new')}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(b => (
          <button
            key={b}
            onClick={() => setTab(b)}
            className={`rounded-xl px-4 py-2 text-sm ${tab === b ? 'bg-[#ff5625] text-white' : 'bg-[#282a2c] text-[#a0a0a8]'}`}
          >
            {t('portal.crm.activities.' + b)} ({buckets[b].length})
          </button>
        ))}
      </div>

      {busy && <p className="text-[#a0a0a8]">{t('portal.crm.common.loading')}</p>}

      <ul className="space-y-2">
        {buckets[tab].map(a => (
          <li key={a.id} className="flex items-start gap-3 rounded-2xl border border-[#3d3f41] bg-[#1e2022] p-4">
            <span className="material-symbols-outlined text-[20px] text-[#00daf3]">
              {a.kind === 'call' ? 'call' : a.kind === 'meeting' ? 'event' : 'task_alt'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#e2e2e5]">{a.subject}</p>
              <p className="mt-1 text-xs text-[#a0a0a8]">
                {a.account_name ?? a.opportunity_name ?? '—'}
                {a.due_at ? ` · ${new Date(a.due_at).toLocaleString('vi-VN')}` : ''}
              </p>
              {a.notes && <p className="mt-2 text-xs text-[#a0a0a8]">{a.notes}</p>}
            </div>
            {!a.done_at && (
              <button
                onClick={() => void done(a.id)}
                className="rounded-xl border border-[#3d3f41] px-3 py-1.5 text-xs text-[#e2e2e5] hover:border-[#ff5625]"
              >
                {t('portal.crm.activity.mark_done')}
              </button>
            )}
          </li>
        ))}
        {!busy && buckets[tab].length === 0 && (
          <li className="rounded-2xl border border-[#3d3f41] p-6 text-center text-sm text-[#a0a0a8]">
            {t('portal.crm.activities.empty')}
          </li>
        )}
      </ul>

      <CrmActivityDrawer open={drawerOpen} ownerId={profile.id} onClose={() => setDrawerOpen(false)} onSaved={load} />
    </PortalShell>
  );
}
