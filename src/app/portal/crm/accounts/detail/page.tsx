'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import {
  deleteCrmContact, getAccountContacts, getAccountOpportunities, getAccountTimeline,
  getCrmAccountById,
} from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import { CrmAccountDrawer } from '@/components/portal/CrmAccountDrawer';
import { CrmContactDrawer } from '@/components/portal/CrmContactDrawer';
import { CrmTransferDialog } from '@/components/portal/CrmTransferDialog';
import type {
  CrmAccountListRow, CrmContact, CrmOpportunityBoardRow, CrmTimelineEntry,
} from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const fmtAt = (s: string | null) => (s ? new Date(s).toLocaleString('vi-VN') : '—');

type Tab = 'overview' | 'contacts' | 'deals' | 'timeline';

function AccountDetail() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params?.get('id') ?? '';
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [account, setAccount] = useState<CrmAccountListRow | null>(null);
  const [deals, setDeals] = useState<CrmOpportunityBoardRow[]>([]);
  const [timeline, setTimeline] = useState<CrmTimelineEntry[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState(true);
  const [editing, setEditing] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CrmContact | null>(null);

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
      const [a, d, tl, ct] = await Promise.all([
        getCrmAccountById(id),
        getAccountOpportunities(id),
        getAccountTimeline(id),
        getAccountContacts(id),
      ]);
      setAccount(a);
      setDeals(d);
      setTimeline(tl);
      setContacts(ct);
    } finally {
      setBusy(false);
    }
  }, [id]);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  if (loading || !profile) return null;

  const card = 'rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)]';
  const TABS: Tab[] = ['overview', 'contacts', 'deals', 'timeline'];

  const removeContact = async (c: CrmContact) => {
    if (!window.confirm(t('portal.crm.contact.delete_confirm'))) return;
    try {
      await deleteCrmContact(c.id);
      toast.success(t('portal.crm.contact.deleted'));
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <CrmNav />

      <Link href="/portal/crm/accounts" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--crm-muted)] hover:text-[#8bd6b6]">
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
                <p className="font-mono text-xs text-[#ffb77d]">{account.code}</p>
                <h1 className="crm-display mt-1 text-xl font-semibold text-[var(--crm-text)]">{account.name}</h1>
                <p className="mt-1 text-sm text-[var(--crm-muted)]">
                  {t(account.kind === 'customer' ? 'portal.crm.account.kind_customer' : 'portal.crm.account.kind_prospect')}
                  {account.org_type && ` · ${t('portal.crm.org.' + account.org_type)}`}
                  {account.province && ` · ${account.province}`}
                </p>
              </div>
              {/* Bàn giao chỉ hiện với người đang phụ trách hoặc quản trị —
                  đúng nhóm mà RPC dưới DB sẽ cho qua. */}
              {(profile.role === 'admin' || account.owner_id === profile.id) && (
                <button
                  onClick={() => setTransferring(true)}
                  className="rounded-xl border border-[var(--crm-line)] px-4 py-2 text-sm text-[var(--crm-text)] hover:border-[#ffb77d]"
                >
                  {t('portal.crm.transfer.title')}
                </button>
              )}
              <button
                onClick={() => setEditing(true)}
                className="rounded-xl border border-[var(--crm-line)] px-4 py-2 text-sm text-[var(--crm-text)] hover:border-[#8bd6b6]"
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
                <p className="crm-display mt-1 text-sm tabular-nums text-[#ffb77d]">
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
                  ? 'bg-[#065f46] text-white'
                  : 'bg-[var(--crm-s3)] text-[var(--crm-muted)]'}`}
              >
                {t('portal.crm.detail.tab_' + b)}
                {b === 'contacts' && contacts.length > 0 && ` (${contacts.length})`}
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

          {tab === 'contacts' && (
            <div className={`${card} overflow-hidden`}>
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-[var(--crm-muted)]">{t('portal.crm.contact.hint')}</p>
                <button
                  onClick={() => { setEditingContact(null); setContactOpen(true); }}
                  className="rounded-xl bg-[#065f46] px-4 py-2 text-sm font-bold text-white"
                >
                  {t('portal.crm.contact.new')}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-[var(--crm-s3)] text-[11px] uppercase tracking-[0.05em] text-[var(--crm-muted)]">
                    <tr>
                      <th className="px-4 py-3">{t('portal.crm.contact.full_name')}</th>
                      <th className="px-4 py-3">{t('portal.crm.contact.title')}</th>
                      <th className="px-4 py-3">{t('portal.crm.account.phone')}</th>
                      <th className="px-4 py-3">Zalo</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.contact.empty')}</td></tr>
                    )}
                    {contacts.map(c => (
                      <tr
                        key={c.id}
                        className="cursor-pointer border-t border-[var(--crm-line)] hover:bg-[var(--crm-s3)]"
                        onClick={() => { setEditingContact(c); setContactOpen(true); }}
                      >
                        <td className="px-4 py-3 text-[var(--crm-text)]">
                          {c.full_name}
                          {c.is_primary && (
                            <span className="ml-2 rounded-full bg-[#ffb77d]/10 px-2 py-0.5 text-xs text-[#ffb77d]">
                              {t('portal.crm.contact.primary_badge')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[var(--crm-muted)]">{c.title ?? '—'}</td>
                        <td className="px-4 py-3 text-[var(--crm-muted)]">
                          {c.phone ?? '—'}
                          {c.do_not_call && (
                            <span className="ml-1 align-middle text-xs text-[#f87171]" title={t('portal.crm.contact.do_not_call')}>
                              <span className="material-symbols-outlined text-[14px]">phone_disabled</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[var(--crm-muted)]">{c.zalo_phone ?? '—'}</td>
                        <td className="px-4 py-3 text-[var(--crm-muted)]">
                          {c.email ?? '—'}
                          {c.do_not_email && (
                            <span className="ml-1 align-middle text-xs text-[#f87171]" title={t('portal.crm.contact.do_not_email')}>
                              <span className="material-symbols-outlined text-[14px]">unsubscribe</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => void removeContact(c)}
                            aria-label={t('portal.crm.contact.delete_confirm')}
                            className="text-[var(--crm-muted)] hover:text-[#f87171]"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                          <span className="rounded-full border border-[#ffb77d]/40 px-2.5 py-1 text-xs text-[#ffb77d]">{d.stage_name}</span>
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
                  <span className={`material-symbols-outlined text-[20px] ${e.entry === 'stage' ? 'text-[#8bd6b6]' : 'text-[#ffb77d]'}`}>
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

          <CrmTransferDialog
            open={transferring}
            accountId={account.id}
            accountName={account.name}
            currentOwnerId={account.owner_id}
            onClose={() => setTransferring(false)}
            onDone={load}
          />

          <CrmContactDrawer
            open={contactOpen}
            accountId={account.id}
            contact={editingContact}
            ownerId={profile.id}
            onClose={() => setContactOpen(false)}
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
