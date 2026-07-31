'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import {
  createCrmOpportunity, getActiveModels, getCrmAccounts, getCrmSettings, getCrmStages,
  getOpenOpportunities, moveOpportunityStage, setCrmAccountStage, setOpportunityQuantity,
  suggestedUnitPrice,
} from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import { CrmAccountDrawer } from '@/components/portal/CrmAccountDrawer';
import { CrmImportDialog } from '@/components/portal/CrmImportDialog';
import { CrmLostReasonDialog } from '@/components/portal/CrmLostReasonDialog';
import type {
  CrmAccount, CrmAccountKind, CrmAccountListRow, CrmOrgType, CrmSettings, CrmStage, ProductModel,
} from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const ORG_TYPES: CrmOrgType[] = ['benh_vien_cong', 'benh_vien_tu', 'phong_kham', 'spa', 'dai_ly', 'khac'];

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
  const [org, setOrg] = useState<CrmOrgType | 'all'>('all');
  const [q, setQ] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CrmAccount | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [losing, setLosing] = useState<{ account: CrmAccountListRow; stage: CrmStage } | null>(null);
  const [models, setModels] = useState<ProductModel[]>([]);
  const [settings, setSettings] = useState<CrmSettings | null>(null);

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

  useEffect(() => {
    if (!session) return;
    void getActiveModels().then(setModels).catch(() => setModels([]));
    void getCrmSettings().then(setSettings).catch(() => setSettings(null));
  }, [session]);

  // Đổi ngay tại chỗ rồi mới gọi máy chủ, để bảng không giật một nhịp.
  // Trigger crm_accounts_stage_sync kéo cơ hội đang mở đi theo, nên tải lại
  // bảng sau đó để số máy và hoa hồng khớp với trang Cơ hội.
  const changeStage = async (account: CrmAccountListRow, stageId: string) => {
    const stage = stages.find(s => s.id === stageId);
    // Chuyển sang "Không mua" thì phải hỏi lý do trước, vì cơ hội đi theo cũng
    // cần lý do — cơ sở dữ liệu từ chối nếu thiếu.
    if (stage?.forecast === 'lost' && account.open_deals > 0) {
      setLosing({ account, stage });
      return;
    }
    const before = rows;
    setRows(rs => rs.map(r => r.id === account.id
      ? { ...r, stage_id: stageId, status_label: stage?.name ?? r.status_label }
      : r));
    try {
      await setCrmAccountStage(account.id, stageId);
      await load();
    } catch (e) {
      setRows(before);
      toast.error((e as Error).message);
    }
  };

  const loseAccount = async (reasonId: string, notes: string) => {
    const target = losing;
    setLosing(null);
    if (!target) return;
    try {
      const open = await getOpenOpportunities(target.account.id);
      for (const o of open) {
        await moveOpportunityStage(o.id, target.stage.id, reasonId, notes);
      }
      await setCrmAccountStage(target.account.id, target.stage.id);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Số máy nhập ở đây ghi vào cơ hội, vì máy thuộc cơ hội chứ không thuộc khách.
  // Chưa có cơ hội nào đang mở thì lập một cơ hội mới cho khách.
  const saveMachines = async (account: CrmAccountListRow, quantity: number) => {
    if (!profile) return;
    if (!Number.isFinite(quantity) || quantity < 1 || quantity === account.total_quantity) {
      await load();
      return;
    }
    try {
      const open = await getOpenOpportunities(account.id);
      if (open.length > 1) {
        toast.error(t('portal.crm.accounts.machines_multi'));
        await load();
        return;
      }
      if (open.length === 1) {
        const o = open[0];
        // Giữ nguyên đơn giá: giá mới = đơn giá cũ × số máy mới.
        const unit = o.quantity > 0 ? Number(o.amount) / o.quantity : 0;
        await setOpportunityQuantity(o.id, quantity, Math.ceil(unit * quantity));
      } else {
        const stage = stages.find(s => s.id === account.stage_id && s.forecast === 'open')
          ?? stages.filter(s => s.forecast === 'open').sort((a, b) => a.sort_order - b.sort_order)[0];
        if (!stage) { toast.error(t('portal.crm.accounts.machines_no_stage')); return; }
        // Chỉ có đúng một model đang bán thì điền sẵn giá gợi ý để hoa hồng dự
        // kiến hiện ngay. Nhiều model thì không đoán, để nhân viên tự chọn.
        const model = models.length === 1 ? models[0] : null;
        const unit = model ? suggestedUnitPrice(model, account.kind, settings) : 0;
        await createCrmOpportunity({
          accountId: account.id,
          stageId: stage.id,
          name: `${t('portal.crm.accounts.new_opp_name')} · ${account.name}`,
          modelId: model?.id ?? null,
          quantity,
          amount: unit * quantity,
          expectedCloseDate: null,
          notes: '',
          ownerId: profile.id,
          lostReasonId: null,
          lostNotes: null,
          trialDays: null,
        });
      }
      toast.success(t('portal.crm.accounts.machines_saved'));
      await load();
    } catch (e) {
      toast.error((e as Error).message);
      await load();
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(r => {
      if (kind !== 'all' && r.kind !== kind) return false;
      if (org !== 'all' && r.org_type !== org) return false;
      if (!needle) return true;
      return [r.name, r.phone, r.code, r.province].some(v => (v ?? '').toLowerCase().includes(needle));
    });
  }, [rows, kind, org, q]);

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
        <select
          className={field}
          value={org}
          onChange={e => setOrg(e.target.value as CrmOrgType | 'all')}
          aria-label={t('portal.crm.account.org_type')}
        >
          <option value="all">{t('portal.crm.accounts.all_orgs')}</option>
          {ORG_TYPES.map(o => <option key={o} value={o}>{t('portal.crm.org.' + o)}</option>)}
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
                onClick={() => router.push(`/portal/crm/accounts/detail?id=${r.id}`)}
              >
                <td className="px-4 py-3 font-mono text-[#00daf3]">{r.code}</td>
                <td className="px-4 py-3 text-[var(--crm-text)]">{r.name}</td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">
                  {t(r.kind === 'customer' ? 'portal.crm.account.kind_customer' : 'portal.crm.account.kind_prospect')}
                  {r.org_type && (
                    <span className="mt-0.5 block text-xs text-[var(--crm-muted)]/70">
                      {t('portal.crm.org.' + r.org_type)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">{r.phone ?? '—'}</td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">{r.province ?? '—'}</td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">{r.source ? t('portal.crm.source.' + r.source) : '—'}</td>
                {/* stopPropagation: gõ số máy không được mở ngăn kéo chi tiết.
                    key gắn số hiện tại để ô nhập nhận lại giá trị sau khi tải lại. */}
                <td className="whitespace-nowrap px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                  <input
                    key={`${r.id}-${r.total_quantity}`}
                    type="number"
                    min={1}
                    defaultValue={r.total_quantity > 0 ? r.total_quantity : ''}
                    aria-label={t('portal.crm.accounts.col_machines')}
                    title={t('portal.crm.accounts.machines_hint')}
                    onBlur={e => void saveMachines(r, Number(e.target.value))}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    className="w-16 rounded-lg border border-[var(--crm-line)] bg-[var(--crm-s2)] px-2 py-1 text-right font-mono tabular-nums text-[var(--crm-text)] outline-none focus:border-[#ff5625]"
                  />
                  {r.open_deals > 0 && (
                    <span className="ml-1 text-xs text-[var(--crm-muted)]">
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
                    onChange={e => void changeStage(r, e.target.value)}
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

      <CrmLostReasonDialog
        key={losing?.account.id ?? 'none'}
        open={losing !== null}
        stageName={losing?.stage.name ?? ''}
        onClose={() => setLosing(null)}
        onConfirm={(reasonId, notes) => void loseAccount(reasonId, notes)}
      />
    </PortalShell>
  );
}
