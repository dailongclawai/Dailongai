'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import {
  cancelAccountCompletionRequest, createCrmOpportunity, getActiveModels, getCrmAccounts,
  getCrmEvidenceCounts, getCrmSettings, getCrmStages, getOpenOpportunities,
  moveOpportunityStage, requestAccountCompletion, setCrmAccountStage, setOpportunityQuantity,
  suggestedUnitPrice,
} from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import { CrmAccountDrawer } from '@/components/portal/CrmAccountDrawer';
import { CrmImportDialog } from '@/components/portal/CrmImportDialog';
import { CrmLostReasonDialog } from '@/components/portal/CrmLostReasonDialog';
import { CrmEvidenceDialog } from '@/components/portal/CrmEvidenceDialog';
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
  if (label === 'Chốt đơn') return 'text-[#8bd6b6] border-[#8bd6b6]/40';
  if (label === 'Mới tiếp nhận') return 'text-[var(--crm-muted)] border-[var(--crm-line)]';
  return 'text-[#ffb77d] border-[#ffb77d]/40';
}

// Chữ cái đầu của từ đầu và từ cuối trong tên — "Trần Thị Hoa" → "TH".
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? words[words.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

// Nằm ở bước hiện tại bao nhiêu ngày rồi. Đếm theo ngày lịch chứ không theo 24
// tiếng: đổi lúc 23h hôm qua thì sáng nay phải là 1 ngày, không phải 0.
function daysInStage(since: string): number {
  const a = new Date(since); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

type SortKey = 'code' | 'name' | 'machines' | 'commission' | 'created' | 'status' | 'owner';
const PAGE_SIZE = 50;

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
  const [evidencing, setEvidencing] = useState<CrmAccountListRow | null>(null);
  const [evidCounts, setEvidCounts] = useState<Record<string, number>>({});
  const [models, setModels] = useState<ProductModel[]>([]);
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('created');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  // Admin lọc bảng theo nhân viên phụ trách; nhân viên thường chỉ thấy khách mình.
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const isAdmin = profile?.role === 'admin';

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
      // Số chứng cứ hỏng cũng không được chặn bảng khách — rơi về map rỗng.
      const [accounts, counts] = await Promise.all([
        getCrmAccounts(),
        getCrmEvidenceCounts().catch(() => ({})),
      ]);
      setRows(accounts);
      setEvidCounts(counts);
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
    if (!profile) return;
    const stage = stages.find(s => s.id === stageId);
    // Boss chốt 02/08/2026: nhân viên không tự chốt "Hoàn thành đơn" — chỉ gửi
    // yêu cầu; quản trị xác nhận xong mới vào bước thắng, mới tính KPI + hoa hồng.
    if (stage?.forecast === 'won' && profile.role !== 'admin') {
      if (!window.confirm(t('portal.crm.accounts.request_confirm'))) return;
      try {
        await requestAccountCompletion(account.id, profile.id);
        toast.success(t('portal.crm.accounts.request_sent'));
        await load();
      } catch (e) {
        toast.error((e as Error).message);
      }
      return;
    }
    // Chuyển sang "Không mua" thì phải hỏi lý do trước, vì cơ hội đi theo cũng
    // cần lý do — cơ sở dữ liệu từ chối nếu thiếu.
    if (stage?.forecast === 'lost' && account.open_deals > 0) {
      setLosing({ account, stage });
      return;
    }
    // Bước thắng/thua là chốt sổ: sau đó chỉ quản trị đổi lại được, nên hỏi
    // lại một câu trước khi khoá. Nhánh trên đã có hộp lý do làm việc này rồi.
    if (stage && stage.forecast !== 'open'
      && !window.confirm(`${stage.name} — ${t('portal.crm.accounts.close_confirm')}`)) {
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

  const cancelRequest = async (account: CrmAccountListRow) => {
    try {
      await cancelAccountCompletionRequest(account.id);
      toast.success(t('portal.crm.accounts.request_cancelled'));
      await load();
    } catch (e) {
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

  // Danh sách nhân viên cho ô lọc — gom từ chính dữ liệu bảng, khỏi gọi thêm API.
  const owners = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      if (r.owner_id && !m.has(r.owner_id)) m.set(r.owner_id, r.owner_name ?? r.owner_email ?? '—');
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [rows]);

  // Dải chỉ số trên bảng — tính từ chính mảng đã tải, không gọi thêm API.
  // "Đang chăm sóc" = chưa chốt sổ (stage_locked đánh dấu thắng/thua).
  // "Chốt tháng này" = đang ở bước thắng và vào bước đó trong tháng hiện tại
  // (stage_since là mốc vào trạng thái hiện tại).
  const stats = useMemo(() => {
    const wonIds = new Set(stages.filter(s => s.forecast === 'won').map(s => s.id));
    const now = new Date();
    const wonThisMonth = rows.filter(r => {
      if (!r.stage_id || !wonIds.has(r.stage_id)) return false;
      const d = new Date(r.stage_since);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    return {
      total: rows.length,
      active: rows.filter(r => !r.stage_locked).length,
      wonThisMonth,
    };
  }, [rows, stages]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(r => {
      if (kind !== 'all' && r.kind !== kind) return false;
      if (org !== 'all' && r.org_type !== org) return false;
      if (isAdmin && ownerFilter !== 'all' && r.owner_id !== ownerFilter) return false;
      if (!needle) return true;
      return [r.name, r.phone, r.code, r.province].some(v => (v ?? '').toLowerCase().includes(needle));
    });
  }, [rows, kind, org, q, isAdmin, ownerFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const val = (r: CrmAccountListRow): string | number => {
      switch (sortKey) {
        case 'code': return r.code ?? '';
        case 'name': return r.name.toLowerCase();
        case 'machines': return r.total_quantity;
        case 'commission': return Number(r.expected_commission);
        case 'status': return r.status_label;
        case 'owner': return (r.owner_name ?? '').toLowerCase();
        default: return r.created_at;
      }
    };
    // sort của JS ổn định nên các dòng bằng nhau giữ nguyên thứ tự từ máy chủ.
    // Chuỗi so bằng localeCompare tiếng Việt, kẻo "Đỗ" bị đẩy xuống sau "Z".
    return [...filtered].sort((a, b) => {
      const va = val(a); const vb = val(b);
      if (typeof va === 'string' && typeof vb === 'string') {
        return va.localeCompare(vb, 'vi') * dir;
      }
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // Đổi bộ lọc hay cách sắp thì quay về trang đầu, kẻo đứng ở trang không còn dòng nào.
  useEffect(() => { setPage(0); }, [q, kind, org, ownerFilter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir(k === 'name' || k === 'code' || k === 'status' ? 'asc' : 'desc');
    }
  };

  // Xuất đúng danh sách đang nhìn thấy: theo bộ lọc và thứ tự hiện tại.
  const exportExcel = () => {
    const data = sorted.map(r => ({
      [t('portal.crm.accounts.col_code')]: r.code ?? '',
      [t('portal.crm.account.name')]: r.name,
      [t('portal.crm.account.kind')]: t(r.kind === 'customer' ? 'portal.crm.account.kind_customer' : 'portal.crm.account.kind_prospect'),
      [t('portal.crm.account.org_type')]: r.org_type ? t('portal.crm.org.' + r.org_type) : '',
      [t('portal.crm.account.phone')]: r.phone ?? '',
      Zalo: r.zalo_phone ?? '',
      Email: r.email ?? '',
      [t('portal.crm.account.province')]: r.province ?? '',
      [t('portal.crm.account.address')]: r.address ?? '',
      [t('portal.crm.account.source')]: r.source ? t('portal.crm.source.' + r.source) : '',
      [t('portal.crm.accounts.col_machines')]: r.total_quantity || 0,
      [t('portal.crm.accounts.col_commission')]: Number(r.expected_commission) || 0,
      [t('portal.crm.accounts.col_status')]: r.status_label,
      [t('portal.crm.account.owner')]: r.owner_name ?? '',
      [t('portal.crm.accounts.col_created')]: new Date(r.created_at).toLocaleDateString('vi-VN'),
      [t('portal.crm.account.notes')]: r.notes ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'KhachHang');
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    XLSX.writeFile(wb, `khach-hang-crm-${stamp}.xlsx`);
  };

  if (loading || !profile) return null;

  // MỘT file mẫu chuẩn dùng chung web + bot Telegram (public/templates/, có
  // dropdown Nguồn/Trạng thái + tooltip từng cột — xlsx community không tạo
  // được nên file dựng sẵn bằng openpyxl). Đổi mẫu thì thay file đó và bản
  // trên VPS /opt/staff-assets/ cùng lúc.
  const downloadTemplate = () => {
    const a = document.createElement('a');
    a.href = '/templates/mau-nhap-khach-hang-crm.xlsx';
    a.download = 'mau-nhap-khach-hang-crm.xlsx';
    a.click();
  };

  const field = 'rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s1)] px-3 py-2 text-[var(--crm-text)] outline-none focus:border-[#8bd6b6]';

  const sortTh = (k: SortKey, labelKey: string, right = false) => (
    <th className={`px-4 py-3 ${right ? 'text-right' : ''}`}>
      <button
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-[var(--crm-text)]"
      >
        {t(labelKey)}
        {sortKey === k && (
          <span className="material-symbols-outlined text-[14px]">
            {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
          </span>
        )}
      </button>
    </th>
  );

  // Dùng chung cho bảng (desktop) và thẻ khách (mobile)
  const renderStatus = (r: CrmAccountListRow) => (
    r.won_requested_at && !r.stage_locked && profile.role !== 'admin' ? (
      /* Nhân viên đã bấm Hoàn thành: trạng thái đọc thẳng là "Hoàn thành đơn —
         chờ xác nhận", thay hẳn ô chọn cho tới khi quản trị duyệt (hoặc huỷ). */
      <>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#fbbf24]/50 bg-[#fbbf24]/10 px-2.5 py-1.5 text-xs font-medium text-[#fbbf24]">
          <span className="material-symbols-outlined text-[14px]">hourglass_top</span>
          {stages.find(s => s.forecast === 'won')?.name ?? ''} · {t('portal.crm.accounts.pending_short')}
        </span>
        <button
          onClick={() => void cancelRequest(r)}
          className="mt-1 block text-xs text-[var(--crm-muted)] underline hover:text-[var(--crm-text)]"
        >
          {t('portal.crm.accounts.cancel_request')}
        </button>
      </>
    ) : (
      <>
        {/* color-scheme dark: bắt trình duyệt vẽ hộp thả xuống theo nền tối,
            nếu không macOS sẽ vẽ nền sáng và chữ màu bị chìm. */}
        {/* Khoá với nhân viên; quản trị vẫn đổi được để gỡ chốt sổ khi
            thao tác nhầm — trigger dưới DB cũng theo đúng luật này. */}
        <select
          aria-label={t('portal.crm.accounts.col_status')}
          value={r.stage_id ?? ''}
          disabled={r.stage_locked && profile.role !== 'admin'}
          title={r.stage_locked ? t('portal.crm.accounts.stage_locked') : undefined}
          onChange={e => void changeStage(r, e.target.value)}
          className={`rounded-full border bg-[var(--crm-s2)] px-2.5 py-1.5 text-xs font-medium outline-none [color-scheme:dark] focus:border-[#8bd6b6] ${STATUS_STYLE(r.status_label)} ${r.stage_locked && profile.role !== 'admin' ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
        >
          {stages.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-[var(--crm-muted)]">
          {daysInStage(r.stage_since) === 0
            ? t('portal.crm.accounts.in_stage_today')
            : `${daysInStage(r.stage_since)} ${t('portal.crm.accounts.in_stage_days')}`}
        </span>
        {/* Quản trị thấy badge vàng + nút duyệt ngay tại chỗ */}
        {r.won_requested_at && !r.stage_locked && profile.role === 'admin' && (
          <span className="mt-1 flex items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#fbbf24]/40 px-2 py-0.5 text-xs text-[#fbbf24]">
              <span className="material-symbols-outlined text-[13px]">hourglass_top</span>
              {t('portal.crm.accounts.pending_confirm')}
            </span>
            {(() => {
              const won = stages.find(s => s.forecast === 'won');
              return won ? (
                <button
                  onClick={() => void changeStage(r, won.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#34d399]/40 px-2 py-0.5 text-xs text-[#34d399] hover:bg-[#34d399]/10"
                >
                  <span className="material-symbols-outlined text-[13px]">check</span>
                  {t('portal.crm.accounts.confirm_now')}
                </button>
              ) : null;
            })()}
          </span>
        )}
        {r.stage_id != null && stages.find(s => s.id === r.stage_id)?.forecast === 'won' && (
          <span className="mt-1 flex items-center gap-1 text-xs text-[#34d399]">
            <span className="material-symbols-outlined text-[13px]">verified</span>
            {t('portal.crm.accounts.confirmed')}
          </span>
        )}
      </>
    )
  );

  // Badge phân loại: khách cá nhân màu ngọc, khách tổ chức màu vàng đồng.
  const kindBadge = (r: CrmAccountListRow) => (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
        r.kind === 'customer'
          ? 'border-[#8bd6b6]/30 bg-[#8bd6b6]/10 text-[#8bd6b6]'
          : 'border-[#ffb77d]/30 bg-[#ffb77d]/10 text-[#ffb77d]'
      }`}
    >
      {t(r.kind === 'customer' ? 'portal.crm.account.kind_customer' : 'portal.crm.account.kind_prospect')}
    </span>
  );

  const renderEvidence = (r: CrmAccountListRow) => (
    <button
      onClick={() => setEvidencing(r)}
      title={(evidCounts[r.id] ?? 0) > 0
        ? `${evidCounts[r.id]} ${t('portal.crm.evidence.count_hint')}`
        : t('portal.crm.evidence.none_hint')}
      aria-label={t('portal.crm.evidence.title')}
      className={`inline-flex items-center gap-1 rounded-lg border p-2 ${
        (evidCounts[r.id] ?? 0) > 0
          ? 'border-[#34d399]/40 text-[#34d399]'
          : 'border-[var(--crm-line)] text-[var(--crm-muted)] hover:text-[var(--crm-text)]'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">
        {(evidCounts[r.id] ?? 0) > 0 ? 'verified' : 'photo_camera'}
      </span>
      {(evidCounts[r.id] ?? 0) > 0 && (
        <span className="font-mono text-xs tabular-nums">{evidCounts[r.id]}</span>
      )}
    </button>
  );

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
        {isAdmin && (
          <select
            className={field}
            value={ownerFilter}
            onChange={e => setOwnerFilter(e.target.value)}
            aria-label={t('portal.crm.account.owner')}
          >
            <option value="all">{t('portal.crm.accounts.all_owners')}</option>
            {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <button
          onClick={exportExcel}
          disabled={sorted.length === 0}
          className="flex items-center gap-2 rounded-xl border border-[var(--crm-line)] px-4 py-2 text-[var(--crm-text)] disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px] text-[#ffb77d]">download</span>
          {t('portal.crm.accounts.export')}
        </button>
        <button
          onClick={downloadTemplate}
          title={t('portal.crm.import.template_hint')}
          className="flex items-center gap-2 rounded-xl border border-[var(--crm-line)] px-4 py-2 text-[var(--crm-text)]"
        >
          <span className="material-symbols-outlined text-[18px] text-[#34d399]">description</span>
          {t('portal.crm.import.template')}
        </button>
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-[var(--crm-line)] px-4 py-2 text-[var(--crm-text)]"
        >
          <span className="material-symbols-outlined text-[18px] text-[#8bd6b6]">upload_file</span>
          {t('portal.crm.import.title')}
        </button>
        <button
          onClick={() => { setEditing(null); setDrawerOpen(true); }}
          className="flex items-center gap-2 rounded-xl bg-[#065f46] px-4 py-2 font-bold text-white"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          {t('portal.crm.accounts.new')}
        </button>
      </div>

      {/* Dải chỉ số nhanh — số thật từ mảng đã tải, không gọi thêm API */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center justify-between rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)] p-4">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-[var(--crm-muted)]">
              {t('portal.crm.accounts.stat_total')}
            </p>
            <p className="text-2xl font-bold tabular-nums text-[var(--crm-text)]">{stats.total}</p>
          </div>
          <span className="material-symbols-outlined text-[28px] text-[#8bd6b6] opacity-50">groups</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)] p-4">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-[var(--crm-muted)]">
              {t('portal.crm.accounts.stat_active')}
            </p>
            <p className="text-2xl font-bold tabular-nums text-[var(--crm-text)]">{stats.active}</p>
          </div>
          <span className="material-symbols-outlined text-[28px] text-[#ffb77d] opacity-50">autorenew</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)] p-4">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-[var(--crm-muted)]">
              {t('portal.crm.accounts.stat_won_month')}
            </p>
            <p className="text-2xl font-bold tabular-nums text-[#8bd6b6]">{stats.wonThisMonth}</p>
          </div>
          <span className="material-symbols-outlined text-[28px] text-[#8bd6b6] opacity-50">task_alt</span>
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-[var(--crm-line)] md:block">
        <table className="w-full min-w-[1240px] text-left text-sm">
          <thead className="bg-[var(--crm-s3)] text-[var(--crm-muted)]">
            <tr>
              {sortTh('code', 'portal.crm.accounts.col_code')}
              {sortTh('name', 'portal.crm.account.name')}
              <th className="px-4 py-3">{t('portal.crm.account.kind')}</th>
              <th className="px-4 py-3">{t('portal.crm.account.phone')}</th>
              <th className="px-4 py-3">{t('portal.crm.account.province')}</th>
              <th className="px-4 py-3">{t('portal.crm.account.source')}</th>
              {isAdmin && sortTh('owner', 'portal.crm.account.owner')}
              {sortTh('machines', 'portal.crm.accounts.col_machines', true)}
              {sortTh('commission', 'portal.crm.accounts.col_commission', true)}
              {sortTh('created', 'portal.crm.accounts.col_created')}
              {sortTh('status', 'portal.crm.accounts.col_status')}
              <th className="px-2 py-3">{t('portal.crm.evidence.col')}</th>
            </tr>
          </thead>
          <tbody>
            {busy && (
              <tr><td colSpan={isAdmin ? 12 : 11} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</td></tr>
            )}
            {!busy && filtered.length === 0 && (
              <tr><td colSpan={isAdmin ? 12 : 11} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.accounts.empty')}</td></tr>
            )}
            {pageRows.map(r => (
              <tr
                key={r.id}
                className="cursor-pointer border-t border-[var(--crm-line)] transition-colors duration-150 hover:bg-[#1e2023]"
                onClick={() => router.push(`/portal/crm/accounts/detail?id=${r.id}`)}
              >
                <td className="px-4 py-3 font-mono text-[#ffb77d]">{r.code}</td>
                <td className="px-4 py-3 text-[var(--crm-text)]">
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#8bd6b6]/25 bg-[#8bd6b6]/15 text-xs font-semibold text-[#8bd6b6]">
                      {initials(r.name)}
                    </span>
                    {r.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">
                  {kindBadge(r)}
                  {r.org_type && (
                    <span className="mt-0.5 block text-xs text-[var(--crm-muted)]/70">
                      {t('portal.crm.org.' + r.org_type)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--crm-muted)]" onClick={e => e.stopPropagation()}>
                  {r.phone
                    ? <a href={`tel:${r.phone}`} className="hover:text-[#ffb77d]">{r.phone}</a>
                    : '—'}
                </td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">{r.province ?? '—'}</td>
                <td className="px-4 py-3 text-[var(--crm-muted)]">{r.source ? t('portal.crm.source.' + r.source) : '—'}</td>
                {isAdmin && (
                  <td className="whitespace-nowrap px-4 py-3 text-[#ffb77d]">{r.owner_name ?? '—'}</td>
                )}
                {/* stopPropagation: gõ số máy không được mở ngăn kéo chi tiết.
                    key gắn số hiện tại để ô nhập nhận lại giá trị sau khi tải lại. */}
                <td className="whitespace-nowrap px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                  <input
                    key={`${r.id}-${r.total_quantity}`}
                    type="number"
                    min={1}
                    defaultValue={r.total_quantity > 0 ? r.total_quantity : ''}
                    aria-label={t('portal.crm.accounts.col_machines')}
                    // Khách đã chốt sổ thì khoá luôn ô này. Gõ số máy sẽ lập cơ hội
                    // mới ở bước mở đầu chuỗi — ra cảnh khách ghi "Không mua" mà
                    // bảng Cơ hội lại bày một thương vụ đang chạy.
                    disabled={r.stage_locked}
                    title={r.stage_locked ? t('portal.crm.accounts.stage_locked') : t('portal.crm.accounts.machines_hint')}
                    onBlur={e => void saveMachines(r, Number(e.target.value))}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    className={`w-16 rounded-lg border border-[var(--crm-line)] bg-[var(--crm-s2)] px-2 py-1 text-right font-mono tabular-nums text-[var(--crm-text)] outline-none focus:border-[#8bd6b6] ${r.stage_locked ? 'cursor-not-allowed opacity-70' : ''}`}
                  />
                  {r.open_deals > 0 && (
                    <span className="ml-1 text-xs text-[var(--crm-muted)]">
                      ({r.open_deals} {t('portal.crm.accounts.open_short')})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-[#ffb77d]">
                  {Number(r.expected_commission) > 0 ? `${fmtVnd(Number(r.expected_commission))}đ` : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--crm-muted)]">
                  {new Date(r.created_at).toLocaleDateString('vi-VN')}
                </td>
                {/* stopPropagation: bấm vào ô chọn không được mở ngăn kéo chi tiết */}
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  {renderStatus(r)}
                </td>
                {/* stopPropagation: bấm nút chứng cứ không được mở trang chi tiết.
                    Có chứng cứ: huy hiệu xanh + số lượng; chưa có: máy ảnh xám. */}
                <td className="whitespace-nowrap px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                  {renderEvidence(r)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile: mỗi khách một thẻ — gọi/Zalo/trạng thái/chứng cứ trong tầm ngón tay */}
      <div className="space-y-3 md:hidden">
        {busy && (
          <p className="py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</p>
        )}
        {!busy && filtered.length === 0 && (
          <p className="py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.accounts.empty')}</p>
        )}
        {pageRows.map(r => (
          <article
            key={r.id}
            onClick={() => router.push(`/portal/crm/accounts/detail?id=${r.id}`)}
            className="cursor-pointer rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--crm-text)]">{r.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-[var(--crm-muted)]">
                  <span className="font-mono text-[#ffb77d]">{r.code}</span>
                  {kindBadge(r)}
                  {r.total_quantity > 0 && <span>{r.total_quantity} {t('portal.crm.opp.machines')}</span>}
                  {isAdmin && r.owner_name && <span className="text-[#ffb77d]">{r.owner_name}</span>}
                </p>
              </div>
              <span onClick={e => e.stopPropagation()}>{renderEvidence(r)}</span>
            </div>
            {(r.phone || r.zalo_phone) && (
              <div className="mt-3 flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                {r.phone && (
                  <a
                    href={`tel:${r.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#ffb77d]/40 px-3 py-2 text-sm text-[#ffb77d]"
                  >
                    <span className="material-symbols-outlined text-[16px]">call</span>
                    {r.phone}
                  </a>
                )}
                {(r.zalo_phone || r.phone) && (
                  <a
                    href={`https://zalo.me/${(r.zalo_phone || r.phone || '').replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--crm-line)] px-3 py-2 text-sm text-[var(--crm-text)]"
                  >
                    Zalo
                  </a>
                )}
              </div>
            )}
            <div className="mt-3" onClick={e => e.stopPropagation()}>
              {renderStatus(r)}
            </div>
          </article>
        ))}
      </div>

      {/* Chỉ hiện khi vượt một trang — đội 2 nhân viên hiện tại sẽ không thấy nó */}
      {sorted.length > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-end gap-3 text-sm text-[var(--crm-muted)]">
          <span className="font-mono tabular-nums">
            {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, sorted.length)} / {sorted.length}
          </span>
          <button
            disabled={safePage === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            className="rounded-xl border border-[var(--crm-line)] px-3 py-1.5 disabled:opacity-40"
          >
            {t('portal.crm.accounts.prev')}
          </button>
          <button
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
            className="rounded-xl border border-[var(--crm-line)] px-3 py-1.5 disabled:opacity-40"
          >
            {t('portal.crm.accounts.next')}
          </button>
        </div>
      )}

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

      <CrmEvidenceDialog
        key={evidencing?.id ?? 'none'}
        open={evidencing !== null}
        accountId={evidencing?.id ?? null}
        accountName={evidencing?.name ?? ''}
        uploaderId={profile.id}
        onClose={() => setEvidencing(null)}
        onSaved={() => {
          void getCrmEvidenceCounts().then(setEvidCounts).catch(() => undefined);
        }}
      />
    </PortalShell>
  );
}
