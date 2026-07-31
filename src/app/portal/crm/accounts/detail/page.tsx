'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import {
  getAccountOpportunities, getAccountTimeline, getCrmAccountById,
} from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import { CrmAccountDrawer } from '@/components/portal/CrmAccountDrawer';
import type {
  CrmAccountListRow, CrmOpportunityBoardRow, CrmTimelineEntry,
} from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const fmtAt = (s: string | null) => (s ? new Date(s).toLocaleString('vi-VN') : '—');

type Tab = 'overview' | 'deals' | 'timeline';

function AccountDetail() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params?.get('id') ?? '';
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [account, setAccount] = useState<CrmAccountListRow | null>(null);
  const [deals, setDeals] = useState<CrmOpportunityBoardRow[]>([]);
  const [timeline, setTimeline] = useState<CrmTimelineEntry[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState(true);
  const [editing, setEditing] = useState(false);

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
    if (!id) { setBusy(false); return; }
    setBusy(true);
    try {
      const [a, d, tl] = await Promise.all([
        getCrmAccountById(id),
        getAccountOpportunities(id),
        getAccountTimeline(id),
      ]);
      setAccount(a);
      setDeals(d);
      setTimeline(tl);
    } finally {
      setBusy(false);
    }
  }, [id]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  if (loading || !profile) return null;

  const card = 'rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)]';
  const TABS: Tab[] = ['overview', 'deals', 'timeline'];

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <CrmNav />

      <Link href="/portal/crm/accounts" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--crm-muted)] hover:text-[#ff5625]">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {t('portal.crm.nav.accounts')}
      </Link>

      {busy && <p className="text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</p>}
      {!busy && !account && (
        <p className="rounded-2xl border border-[var(--crm-line)] p-6 text-center text-[var(--crm-muted)]">
          {t('portal.crm.detail.not_found')}
        </p>
      )}

      {account && (
        <>
          <div className={`${card} mb-5 p-5`}>
            <div className="flex flex-wrap items-start gap-4">
              <div className="mr-auto">
                <p className="font-mono text-xs text-[#00daf3]">{account.code}</p>
                <h1 className="crm-display mt-1 text-xl font-semibold text-[var(--crm-text)]">{account.name}</h1>
                <p className="mt-1 text-sm text-[var(--crm-muted)]">
                  {t(account.kind === 'customer' ? 'portal.crm.account.kind_customer' : 'portal.crm.account.kind_prospect')}
                  {account.org_type && ` · ${t('portal.crm.org.' + account.org_type)}`}
                  {account.province && ` · ${account.province}`}
                </p>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="rounded-xl border border-[var(--crm-line)] px-4 py-2 text-sm text-[var(--crm-text)] hover:border-[#ff5625]"
              >
                {t('portal.crm.detail.edit')}
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.05em] text-[var(--crm-muted)]">{t('portal.crm.accounts.col_status')}</p>
                <p className="mt-1 text-sm text-[var(--crm-text)]">{account.status_label}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.05em] text-[var(--crm-muted)]">{t('portal.crm.accounts.col_machines')}</p>
                <p className="crm-display mt-1 text-sm tabular-nums text-[var(--crm-text)]">
                  {account.total_quantity > 0 ? account.total_quantity : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.05em] text-[var(--crm-muted)]">{t('portal.crm.accounts.col_commission')}</p>
                <p className="crm-display mt-1 text-sm tabular-nums text-[#00daf3]">
                  {Number(account.expected_commission) > 0 ? `${fmtVnd(Number(account.expected_commission))}đ` : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {TABS.map(b => (
              <button
                key={b}
                onClick={() => setTab(b)}
                className={`rounded-xl px-4 py-2 text-sm ${tab === b
                  ? 'bg-[#ff5625] text-white'
                  : 'bg-[var(--crm-s3)] text-[var(--crm-muted)]'}`}
              >
                {t('portal.crm.detail.tab_' + b)}
                {b === 'deals' && deals.length > 0 && ` (${deals.length})`}
                {b === 'timeline' && timeline.length > 0 && ` (${timeline.length})`}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className={`${card} grid gap-4 p-5 sm:grid-cols-2`}>
              {([
                ['portal.crm.account.phone', account.phone],
                ['portal.crm.account.zalo', account.zalo_phone],
                ['portal.crm.account.email', account.email],
                ['portal.crm.account.tax_code', account.tax_code],
                ['portal.crm.account.address', account.address],
                ['portal.crm.account.source', account.source ? t('portal.crm.source.' + account.source) : null],
                ['portal.crm.account.owner', account.owner_name],
                ['portal.crm.account.notes', account.notes],
              ] as const).map(([key, value]) => (
                <div key={key}>
                  <p className="text-[11px] uppercase tracking-[0.05em] text-[var(--crm-muted)]">{t(key)}</p>
                  <p className="mt-1 text-sm text-[var(--crm-text)]">{value || '—'}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'deals' && (
            <div className={`${card} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-[var(--crm-s3)] text-[11px] uppercase tracking-[0.05em] text-[var(--crm-muted)]">
                    <tr>
                      <th className="px-4 py-3">{t('portal.crm.dash.col_opp')}</th>
                      <th className="px-4 py-3">{t('portal.crm.dash.col_stage')}</th>
                      <th className="px-4 py-3 text-right">{t('portal.crm.opp.quantity')}</th>
                      <th className="px-4 py-3 text-right">{t('portal.crm.dash.col_amount')}</th>
                      <th className="px-4 py-3 text-right">{t('portal.crm.dash.col_due')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.detail.no_deals')}</td></tr>
                    )}
                    {deals.map(d => (
                      <tr key={d.id} className="border-t border-[var(--crm-line)]">
                        <td className="px-4 py-3 text-[var(--crm-text)]">
                          {d.name}
                          {d.code && <span className="ml-2 font-mono text-xs text-[var(--crm-muted)]">{d.code}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-[#00daf3]/40 px-2.5 py-1 text-xs text-[#00daf3]">{d.stage_name}</span>
                        </td>
                        <td className="crm-display px-4 py-3 text-right tabular-nums text-[var(--crm-text)]">{d.quantity}</td>
                        <td className="crm-display px-4 py-3 text-right tabular-nums text-[var(--crm-text)]">{fmtVnd(Number(d.amount))}đ</td>
                        <td className="px-4 py-3 text-right text-[var(--crm-muted)]">{d.expected_close_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'timeline' && (
            <ol className="space-y-2">
              {timeline.length === 0 && (
                <li className={`${card} p-6 text-center text-sm text-[var(--crm-muted)]`}>
                  {t('portal.crm.detail.no_timeline')}
                </li>
              )}
              {timeline.map((e, i) => (
                <li key={`${e.entry}-${e.at}-${i}`} className={`${card} flex gap-3 p-4`}>
                  <span className={`material-symbols-outlined text-[20px] ${e.entry === 'stage' ? 'text-[#ff5625]' : 'text-[#00daf3]'}`}>
                    {e.entry === 'stage' ? 'trending_up'
                      : e.sub_kind === 'call' ? 'call'
                        : e.sub_kind === 'meeting' ? 'event' : 'task_alt'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--crm-text)]">{e.title}</p>
                    {e.detail && <p className="mt-1 text-xs text-[var(--crm-muted)]">{e.detail}</p>}
                    <p className="mt-1 text-xs text-[var(--crm-muted)]">
                      {fmtAt(e.at)}{e.who ? ` · ${e.who}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <CrmAccountDrawer
            open={editing}
            account={account}
            ownerId={profile.id}
            onClose={() => setEditing(false)}
            onSaved={load}
          />
        </>
      )}
    </PortalShell>
  );
}

// useSearchParams cần ranh giới Suspense khi trang được dựng sẵn lúc build.
export default function CrmAccountDetailPage() {
  return (
    <Suspense fallback={null}>
      <AccountDetail />
    </Suspense>
  );
}
