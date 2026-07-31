'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getCrmAccounts, getCrmStages, setCrmAccountStage } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import { CrmAccountDrawer } from '@/components/portal/CrmAccountDrawer';
import { CrmImportDialog } from '@/components/portal/CrmImportDialog';
import type { CrmAccount, CrmAccountKind, CrmAccountListRow, CrmStage } from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

// Chỉ đổi màu CHỮ và viền, giữ nền đặc. Nền trong suốt làm hộp thả xuống của
// native select không đọc được vì trình duyệt bỏ qua style đặt trên <option>.
function STATUS_STYLE(label: string): string {
  if (label === 'Hoàn thành đơn') return 'text-[#34d399] border-[#34d399]/40';
  if (label === 'Không mua') return 'text-[#f87171] border-[#f87171]/40';
  if (label === 'Chốt đơn') return 'text-[#ff5625] border-[#ff5625]/40';
  if (label === 'Mới tiếp nhận') return 'text-[var(--crm-muted)] border-[var(--crm-line)]';
  return 'text-[#00daf3] border-[#00daf3]/40';
}

export default function CrmAccountsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [rows, setRows] = useState<CrmAccountListRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [kind, setKind] = useState<CrmAccountKind | 'all'>('all');
  const [q, setQ] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CrmAccount | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [stages, setStages] = useState<CrmStage[]>([]);

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
      setRows(await getCrmAccounts());
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  useEffect(() => {
    if (session) void getCrmStages().then(setStages).catch(() => setStages([]));
  }, [session]);

  // Đổi ngay tại chỗ rồi mới gọi máy chủ, để bảng không giật một nhịp.
  const changeStage = async (accountId: string, stageId: string) => {
    const before = rows;
    const stage = stages.find(s => s.id === stageId);
    setRows(rs => rs.map(r => r.id === accountId
      ? { ...r, stage_id: stageId, status_label: stage?.name ?? r.status_label }
      : r));
    try {
      await setCrmAccountStage(accountId, stageId);
    } catch (e) {
      setRows(before);
      toast.error((e as Error).message);
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(r => {
      if (kind !== 'all' && r.kind !== kind) return false;
      if (!needle) return true;
      return [r.name, r.phone, r.code, r.province].some(v => (v ?? '').toLowerCase().includes(needle));
    });
  }, [rows, kind, q]);

  if (loading || !profile) return null;

  const field = 'rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s1)] px-3 py-2 text-[var(--crm-text)] outline-none focus:border-[#ff5625]';

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <CrmNav />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold text-[var(--crm-text)]">{t('portal.crm.accounts.title')}</h1>
        <input
          className={field}
          placeholder={t('portal.crm.accounts.search')}
          value={q}
          onChange={e => setQ(e.target.value)}
          aria-label={t('portal.crm.accounts.search')}
        />
        <select className={field} value={kind} onChange={e => setKind(e.target.value as CrmAccountKind | 'all')} aria-label={t('portal.crm.account.kind')}>
          <option value="all">{t('portal.crm.accounts.all_kinds')}</option>
          <option value="customer">{t('portal.crm.account.kind_customer')}</option>
          <option value="dealer_prospect">{t('portal.crm.account.kind_prospect')}</option>
        </select>
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-[var(--crm-line)] px-4 py-2 text-[var(--crm-text)]"
        >
          <span className="material-symbols-outlined text-[18px]">upload_file</span>
          {t('portal.crm.import.title')}
        </button>
        <button
          onClick={() => { setEditing(null); setDrawerOpen(true); }}
          className="rounded-xl bg-[#ff5625] px-4 py-2 font-bold text-white"
        >
          {t('portal.crm.accounts.new')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--crm-line)]">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-[var(--crm-s3)] text-[var(--crm-muted)]">
            <tr>
              <th className="px-4 py-3">{t('portal.crm.accounts.col_code')}</th>
              <th className="px-4 py-3">{t('portal.crm.account.name')}</th>
              <th className="px-4 py-3">{t('portal.crm.account.kind')}</th>
              <th className="px-4 py-3">{t('portal.crm.account.phone')}</th>
              <th className="px-4 py-3">{t('portal.crm.account.province')}</th>
              <th className="px-4 py-3">{t('portal.crm.account.source')}</th>
              <th className="px-4 py-3 text-right">{t('portal.crm.accounts.col_machines')}</th>
              <th className="px-4 py-3 text-right">{t('portal.crm.accounts.col_commission')}</th>
              <th className="px-4 py-3">{t('portal.crm.accounts.col_status')}</th>
            </tr>
          </thead>
          <tbody>
            {busy && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</td></tr>
            )}
            {!busy && filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.accounts.empty')}</td></tr>
            )}
            {filtered.map(r => (
              <tr
                key={r.id}
                className="cursor-pointer border-t border-[var(--crm-line)] hover:bg-[var(--crm-s3)]"
                onClick={() => { setEditing(r); setDrawerOpen(true); }}
              >
                <td className="px-4 py-3 font-mono text-[#00daf3]">{r.code}</td>
                <td className="px-4 py-3 text-[var(--crm-text)]">{r.name}</td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">
                  {t(r.kind === 'customer' ? 'portal.crm.account.kind_customer' : 'portal.crm.account.kind_prospect')}
                </td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">{r.phone ?? '—'}</td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">{r.province ?? '—'}</td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">{r.source ? t('portal.crm.source.' + r.source) : '—'}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--crm-text)]">
                  {r.total_quantity > 0 ? r.total_quantity : '—'}
                  {r.open_deals > 0 && (
                    <span className="ml-1 text-xs font-sans text-[var(--crm-muted)]">
                      ({r.open_deals} {t('portal.crm.accounts.open_short')})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-[#00daf3]">
                  {Number(r.expected_commission) > 0 ? `${fmtVnd(Number(r.expected_commission))}đ` : '—'}
                </td>
                {/* stopPropagation: bấm vào ô chọn không được mở ngăn kéo chi tiết */}
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  {/* color-scheme dark: bắt trình duyệt vẽ hộp thả xuống theo nền tối,
                      nếu không macOS sẽ vẽ nền sáng và chữ màu bị chìm. */}
                  <select
                    aria-label={t('portal.crm.accounts.col_status')}
                    value={r.stage_id ?? ''}
                    onChange={e => void changeStage(r.id, e.target.value)}
                    className={`cursor-pointer rounded-full border bg-[var(--crm-s2)] px-2.5 py-1.5 text-xs font-medium outline-none [color-scheme:dark] focus:border-[#ff5625] ${STATUS_STYLE(r.status_label)}`}
                  >
                    {stages.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CrmAccountDrawer
        open={drawerOpen}
        account={editing}
        ownerId={profile.id}
        onClose={() => setDrawerOpen(false)}
        onSaved={load}
      />

      <CrmImportDialog
        open={importOpen}
        ownerId={profile.id}
        onClose={() => setImportOpen(false)}
        onDone={load}
      />
    </PortalShell>
  );
}
