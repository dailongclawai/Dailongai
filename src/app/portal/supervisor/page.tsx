'use client';

import { useEffect, useMemo, useState, Fragment, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { DailyOrdersChart } from '@/components/portal/DailyOrdersChart';
import { SupervisorIncomeSummary } from '@/components/portal/SupervisorIncomeSummary';
import { TierCard } from '@/components/portal/TierCard';
import { MonthlyGoalCard } from '@/components/portal/MonthlyGoalCard';
import { PodiumLeaderboard } from '@/components/portal/PodiumLeaderboard';
import { SupervisorFunnelCard } from '@/components/portal/FunnelChart';
import {
  getSupervisorTeam, getMyPayouts, getDealerCurrentCommissions,
  setDealerFixedCommission, clearDealerFixedCommission,
  getSupervisorLedger, createPayoutRequest, getMyPayoutRequests,
  getSupervisorCurrentGoal, getTeamLeaderboard,
} from '@/lib/portal-queries';
import type { TeamMember, PayoutRow, DealerCurrentCommission } from '@/lib/portal-types';
import type { SupervisorLedgerRow, LedgerRow, PayoutRequest, SupervisorGoal, LeaderboardRow } from '@/lib/portal-queries';

const MIN_FIXED = 4500000;
const MAX_FIXED = 12000000;
const STEP_FIXED = 500000;

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

type Tab = 'team' | 'commission';
type Bucket = 'all' | 'pending' | 'approved' | 'paid' | 'rejected';

function statusOf(r: LedgerRow): { label: string; cls: string; dot: string; bucket: Exclude<Bucket, 'all'> } {
  if (r.status === 'rejected') return { label: 'Từ chối', cls: 'text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20', dot: 'bg-[#f87171]', bucket: 'rejected' };
  if (r.status === 'voided' || r.commission?.voided_at) return { label: 'Đã hủy', cls: 'text-[#9ca3af] bg-[#1a1f26] border-[#1f2937]/40', dot: 'bg-[#a0a0a8]', bucket: 'rejected' };
  if (r.commission?.paid_at) return { label: 'Đã thanh toán', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', bucket: 'paid' };
  if (r.commission) return { label: 'Đã duyệt · chờ chi', cls: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20', dot: 'bg-[#3b82f6]', bucket: 'approved' };
  if (r.status === 'pending') return { label: 'Chờ duyệt', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', bucket: 'pending' };
  if (r.status === 'approved') return { label: 'Đã duyệt', cls: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20', dot: 'bg-[#3b82f6]', bucket: 'approved' };
  if (r.status === 'paid') return { label: 'Đã thanh toán', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', bucket: 'paid' };
  return { label: 'Đang xử lý', cls: 'text-[#9ca3af] bg-[#1a1f26] border-[#1f2937]/40', dot: 'bg-[#a0a0a8]', bucket: 'pending' };
}

const rateOf = (r: LedgerRow) =>
  r.commission && !r.commission.voided_at && Number(r.sale_price) > 0
    ? +(Number(r.commission.amount) / Number(r.sale_price) * 100).toFixed(2)
    : null;

function overrideLabel(pct: number | null): { name: string; cls: string } {
  if (pct === null) return { name: 'Tạm tính', cls: 'bg-[#1a1f26] text-[#9ca3af] border-[#1f2937]/40' };
  return { name: `Override ${pct}%`, cls: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20' };
}

export default function SupervisorPage() {
  return (
    <Suspense fallback={null}>
      <SupervisorDashboard />
    </Suspense>
  );
}

function SupervisorDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'commission' ? 'commission' : 'team';
  const { session, profile, loading } = useAuth();

  // Team tab state
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [refLink, setRefLink] = useState('');
  const [qr, setQr] = useState('');
  const [currentByDealer, setCurrentByDealer] = useState<Record<string, DealerCurrentCommission>>({});
  const [goal, setGoal] = useState<SupervisorGoal | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [editingDealer, setEditingDealer] = useState<TeamMember | null>(null);
  const [editAmount, setEditAmount] = useState(6000000);
  const [savingPlan, setSavingPlan] = useState(false);

  // Commission tab state
  const [rows, setRows] = useState<SupervisorLedgerRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [filter, setFilter] = useState<Bucket>('all');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqAmount, setReqAmount] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [reqBusy, setReqBusy] = useState(false);
  const [myRequests, setMyRequests] = useState<PayoutRequest[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/portal/login'); return; }
    if (profile?.role !== 'supervisor') { router.replace('/portal/403'); return; }
    if (!profile) return;
    getSupervisorTeam(session.user.id).then(async (t) => {
      setTeam(t);
      if (t.length) setCurrentByDealer(await getDealerCurrentCommissions(t.map((r) => r.dealer_id)));
    });
    getSupervisorLedger(profile.id).then(setRows);
    getMyPayouts().then(setPayouts);
    getMyPayoutRequests().then(setMyRequests);
    getSupervisorCurrentGoal().then(setGoal).catch(() => setGoal(null));
    getTeamLeaderboard().then(setLeaderboard).catch(() => setLeaderboard([]));
  }, [loading, session, profile, router]);

  useEffect(() => {
    if (!session) return;
    const base = process.env.NEXT_PUBLIC_PORTAL_URL || window.location.origin;
    const link = `${base}/portal/register?ref=${session.user.id}`;
    setRefLink(link);
    QRCode.toDataURL(link, { width: 512, margin: 2, color: { dark: '#0c0e10', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  }, [session]);

  const stats = useMemo(() => {
    let pendingCnt = 0, pendingVal = 0;
    let approvedCnt = 0, approvedVal = 0;
    let paidCnt = 0, paidVal = 0;
    for (const r of rows) {
      const c = r.commission;
      if (c?.paid_at && !c.voided_at) { paidCnt++; paidVal += Number(c.amount); continue; }
      if (c && !c.voided_at) { approvedCnt++; approvedVal += Number(c.amount); continue; }
      if (r.status === 'pending') { pendingCnt++; pendingVal += Number(r.sale_price); }
    }
    return { pendingCnt, pendingVal, approvedCnt, approvedVal, paidCnt, paidVal };
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    const b = statusOf(r).bucket;
    if (filter !== 'all' && b !== filter) return false;
    const haystack = `${r.serial_number ?? ''} ${r.customer_name} ${r.dealer_name ?? ''}`.toLowerCase();
    if (q && !haystack.includes(q.toLowerCase())) return false;
    if (from && r.sale_date < from) return false;
    if (to && r.sale_date > to) return false;
    return true;
  }), [rows, filter, q, from, to]);

  if (loading || profile?.role !== 'supervisor') return null;

  // ── Team handlers ──
  const copyLink = async () => { await navigator.clipboard.writeText(refLink); toast.success('Đã copy link mời đại lý'); };
  const downloadQR = () => {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = `dai-long-moi-dai-ly-${(profile?.full_name || 'supervisor').toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast.success('Đã tải QR mời đại lý');
  };
  const openCommissionEditor = (t: TeamMember) => {
    const curr = currentByDealer[t.dealer_id];
    setEditAmount(curr?.override_amount ? Number(curr.override_amount) : 6000000);
    setEditingDealer(t);
  };

  const saveFixedAmount = async () => {
    if (!editingDealer) return;
    if (editAmount < MIN_FIXED || editAmount > MAX_FIXED) {
      toast.error(`Số tiền phải từ ${MIN_FIXED.toLocaleString('vi-VN')} đến ${MAX_FIXED.toLocaleString('vi-VN')} đ`);
      return;
    }
    setSavingPlan(true);
    try {
      await setDealerFixedCommission(editingDealer.dealer_id, editAmount);
      const fresh = await getDealerCurrentCommissions(team.map((r) => r.dealer_id));
      setCurrentByDealer(fresh);
      toast.success(`Đã set hoa hồng cố định cho ${editingDealer.dealer_name ?? 'đại lý'}`);
      setEditingDealer(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi cập nhật hoa hồng');
    } finally { setSavingPlan(false); }
  };

  const clearFixedAmount = async () => {
    if (!editingDealer) return;
    setSavingPlan(true);
    try {
      await clearDealerFixedCommission(editingDealer.dealer_id);
      const fresh = await getDealerCurrentCommissions(team.map((r) => r.dealer_id));
      setCurrentByDealer(fresh);
      toast.success(`Đã chuyển ${editingDealer.dealer_name ?? 'đại lý'} về tier auto`);
      setEditingDealer(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi xoá override');
    } finally { setSavingPlan(false); }
  };

  // ── Commission handlers ──
  const exportExcel = () => {
    if (filtered.length === 0) { toast.error('Không có đơn để xuất'); return; }
    const data = filtered.map((r) => {
      const pct = rateOf(r);
      const st = statusOf(r);
      return {
        'Số serial': r.serial_number ?? '',
        'Đại lý': r.dealer_name ?? '',
        'Khách hàng': r.customer_name,
        'Giá bán (₫)': Number(r.sale_price),
        'Override': overrideLabel(pct).name,
        'Hoa hồng (₫)': r.commission && !r.commission.voided_at ? Number(r.commission.amount) : '',
        'Trạng thái': st.label,
        'Ngày đặt': r.sale_date,
        'Ngày thanh toán': r.commission?.paid_at ?? '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hoa hồng SV');
    XLSX.writeFile(wb, `hoa-hong-sv-${profile.full_name || 'supervisor'}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Đã xuất ${filtered.length} đơn`);
  };

  const openRequest = () => {
    if (stats.approvedVal <= 0) { toast.error('Chưa có hoa hồng đã duyệt để yêu cầu tất toán'); return; }
    setReqAmount(String(stats.approvedVal)); setReqNotes(''); setReqOpen(true);
  };
  const submitRequest = async () => {
    const amt = Number(reqAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Số tiền không hợp lệ'); return; }
    if (amt > stats.approvedVal) { toast.error('Vượt số dư đã duyệt chờ chi'); return; }
    setReqBusy(true);
    try {
      await createPayoutRequest(amt, 'supervisor', reqNotes.trim() || undefined);
      toast.success('Đã gửi yêu cầu tất toán');
      setReqOpen(false);
      setMyRequests(await getMyPayoutRequests());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không gửi được yêu cầu');
    } finally { setReqBusy(false); }
  };

  const goTab = (next: Tab) => {
    const url = new URL(window.location.href);
    if (next === 'team') url.searchParams.delete('tab');
    else url.searchParams.set('tab', next);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  const reqStatusCls: Record<PayoutRequest['status'], string> = {
    pending: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    approved: 'text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20',
    rejected: 'text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20',
    paid: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };
  const reqStatusLabel: Record<PayoutRequest['status'], string> = {
    pending: 'Chờ duyệt', approved: 'Đã duyệt · chờ chi', rejected: 'Từ chối', paid: 'Đã chi',
  };

  const tabBtn = (key: Tab, label: string, icon: string) => {
    const active = tab === key;
    return (
      <button
        onClick={() => goTab(key)}
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
          active ? 'bg-[#10b981] text-[#0c0e10] shadow-lg ' : 'text-[#e7eaf0]/60 hover:bg-[#1a1f26] hover:text-[#e7eaf0]'
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
        {label}
      </button>
    );
  };

  const activeCount = team.filter((t) => Number(t.month_sales) > 0).length;
  const pendingTeamOrders = team.reduce((s, t) => s + Number(t.orders_pending), 0);

  return (
    <PortalShell variant="supervisor">
      {/* Header + Tab nav */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#10b981]">Supervisor</p>
          <h1 className="mt-2 font-headline text-4xl">{profile.full_name || 'Supervisor'} · điều phối nhánh</h1>
        </div>
        <div className="inline-flex gap-1 rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-1">
          {tabBtn('team', 'Đội ngũ', 'groups')}
          {tabBtn('commission', 'Sổ hoa hồng', 'payments')}
        </div>
      </div>

      {tab === 'team' && (
        <>
          {/* Tier supervisor + Mục tiêu tháng (side by side) */}
          <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <TierCard profileId={profile.id} audience="supervisor" />
            <MonthlyGoalCard goal={goal} />
          </div>

          {/* Leaderboard + Funnel side-by-side on desktop */}
          <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <PodiumLeaderboard rows={leaderboard} />
            <SupervisorFunnelCard supervisorId={profile.id} />
          </div>

          {/* Activity stats (focus on people/activity, not revenue) */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">Đại lý trong đội</p>
              <p className="mt-2 font-mono text-3xl font-medium tabular-nums">{team.length}</p>
            </div>
            <div className="rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">Active tháng này</p>
              <p className="mt-2 font-mono text-3xl font-medium tabular-nums text-[#10b981]">{activeCount}</p>
            </div>
            <div className="rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">Đơn chờ duyệt</p>
              <p className="mt-2 font-mono text-3xl font-medium tabular-nums text-[#ff5625]">{pendingTeamOrders}</p>
            </div>
          </div>

          {/* QR invite */}
          <div className="relative mb-8 overflow-hidden rounded-3xl border border-[#10b981]/30 bg-gradient-to-br from-[#10b981]/[0.08] via-[#1e2022] to-[#1e2022] p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#10b981]/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[#ff5625]/5 blur-3xl" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
              <div className="shrink-0">
                <div className="rounded-2xl border border-[#10b981]/30 bg-gradient-to-br from-white to-[#f5fdf8] p-3 shadow-[0_8px_32px_-8px_rgba(52,211,153,0.4)]">
                  {qr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qr} alt="QR mời đại lý" className="h-40 w-40 rounded-lg sm:h-44 sm:w-44" />
                  ) : (
                    <div className="h-40 w-40 animate-pulse rounded-lg bg-[#11151a]/10 sm:h-44 sm:w-44" />
                  )}
                </div>
                <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-[#10b981]/70">{profile?.full_name || 'Supervisor'}</p>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#10b981]">share</span>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#10b981]">Mời đại lý vào nhánh</p>
                </div>
                <h2 className="mt-2 font-headline text-2xl leading-tight sm:text-3xl">QR riêng của <span className="text-[#10b981]">bạn</span></h2>
                <p className="mt-2 text-sm leading-relaxed text-[#e7eaf0]/70">
                  Gửi QR hoặc link này cho đại lý. Khi họ đăng ký qua đó, tài khoản sẽ tự động thuộc nhánh của bạn và bạn thấy được toàn bộ số liệu kinh doanh.
                </p>
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#1f2937]/50 bg-[#11151a]/80 px-3 py-2 backdrop-blur-sm">
                  <span className="material-symbols-outlined text-[16px] text-[#e7eaf0]/40">link</span>
                  <input readOnly value={refLink} className="min-w-0 flex-1 truncate bg-transparent text-xs text-[#e7eaf0]/80 outline-none" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={copyLink} className="flex items-center gap-2 rounded-full bg-[#ff5625] px-5 py-2.5 text-xs font-semibold text-white shadow-lg  transition-all hover:bg-[#ff5625]/90 hover: active:scale-[0.98]">
                    <span className="material-symbols-outlined text-[16px]">content_copy</span> Copy link
                  </button>
                  <button onClick={downloadQR} disabled={!qr} className="flex items-center gap-2 rounded-full border border-[#10b981]/40 bg-[#10b981]/10 px-5 py-2.5 text-xs font-semibold text-[#10b981] transition-all hover:bg-[#10b981]/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
                    <span className="material-symbols-outlined text-[16px]">download</span> Tải QR
                  </button>
                </div>
                <p className="mt-4 flex items-start gap-1.5 text-[11px] text-[#e7eaf0]/45">
                  <span className="material-symbols-outlined text-[14px] text-[#e7eaf0]/45">tips_and_updates</span>
                  In QR ra để dán tại điểm bán, hoặc gửi Zalo/email cho đại lý mới.
                </p>
              </div>
            </div>
          </div>

          {/* Unified dealer card grid (mobile stack, desktop 2/3 cols) */}
          {team.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#1f2937] bg-[#11151a] p-10 text-center text-sm text-[#9ca3af]">
              Chưa có đại lý trong đội. Chia sẻ QR ở trên để mời.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[...team].sort((a, b) => Number(b.month_sales) - Number(a.month_sales)).map((t) => {
                const act = Number(t.month_sales) > 0
                  ? { label: 'Hoạt động', cls: 'bg-[#10b981]/15 text-[#10b981]' }
                  : Number(t.orders_pending) > 0
                    ? { label: 'Có đơn chờ', cls: 'bg-[#ff5625]/15 text-[#ff5625]' }
                    : { label: 'Im ắng', cls: 'bg-[#1a1f26] text-[#9ca3af]' };
                const comm = currentByDealer[t.dealer_id];
                const name = t.dealer_name ?? '(không tên)';
                const initials = name.trim().split(/\s+/).slice(-2).map((w) => w[0] ?? '').join('').toUpperCase() || '?';
                const hash = Array.from(t.dealer_id).reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 0);
                const gradients = [
                  'from-[#ff5625] to-[#f59e0b]',
                  'from-[#3b82f6] to-[#06b6d4]',
                  'from-[#10b981] to-[#84cc16]',
                  'from-[#a855f7] to-[#ec4899]',
                  'from-[#f59e0b] to-[#ef4444]',
                  'from-[#06b6d4] to-[#8b5cf6]',
                  'from-[#84cc16] to-[#22d3ee]',
                  'from-[#ec4899] to-[#fb7185]',
                ];
                const gradient = gradients[hash % gradients.length];
                return (
                  <div
                    key={t.dealer_id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-[#1f2937] bg-[#11151a] transition-colors hover:border-[#1f2937]/80"
                  >
                    <div className="flex items-start gap-3 border-b border-[#1f2937] p-4">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-bold text-white`}>
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[#e7eaf0]">{name}</p>
                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${act.cls}`}>
                          {act.label}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-3 text-center">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-[#9ca3af]">Doanh số</p>
                        <p className="mt-1 font-mono text-sm font-semibold tabular-nums">{fmtVnd(Number(t.month_sales))}</p>
                      </div>
                      <div className="border-x border-[#1f2937]">
                        <p className="text-[9px] uppercase tracking-wider text-[#9ca3af]">Máy YTD</p>
                        <p className="mt-1 font-mono text-sm font-semibold tabular-nums">{t.units_ytd}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-[#9ca3af]">Chờ</p>
                        <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#ff5625]">{t.orders_pending}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => openCommissionEditor(t)}
                      className="flex items-center justify-between gap-3 border-t border-[#1f2937] bg-[#0a0c0f] px-4 py-3 text-left transition-colors hover:bg-[#10b981]/10 active:bg-[#10b981]/20"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px] text-[#10b981]">payments</span>
                        <span className="text-sm font-medium">Hoa hồng</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold tabular-nums">{comm?.rate_display ?? '15%'}</span>
                        {comm?.source === 'fixed' && (
                          <span className="rounded-sm bg-[#ff5625]/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#ff5625]">Cố định</span>
                        )}
                        <span className="material-symbols-outlined text-[18px] text-[#9ca3af]">chevron_right</span>
                      </span>
                    </button>
                    <Link
                      href={`/portal/supervisor/team?dealer=${t.dealer_id}`}
                      className="border-t border-[#1f2937] px-4 py-2.5 text-center text-xs text-[#ff5625] transition-colors hover:bg-[#1a1f26]"
                    >
                      Chi tiết →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'commission' && (
        <>
          {/* Income summary (đẹp riêng cho supervisor) */}
          <div className="mb-8">
            <SupervisorIncomeSummary payouts={payouts} />
          </div>

          {/* Daily orders chart đội */}
          <div className="mb-8">
            <DailyOrdersChart rows={rows} days={30} title="Doanh số đội theo ngày" />
          </div>

          {/* Action bar */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Sổ hoa hồng từ đội</p>
              <p className="mt-1 text-sm text-[#9ca3af]">Mọi đơn do đại lý trong nhánh chốt — kèm phần override.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={exportExcel} className="flex items-center gap-2 rounded-lg border border-[#1f2937]/40 bg-[#1a1f26] px-4 py-2 text-sm font-medium hover:border-[#ff5625]">
                <span className="material-symbols-outlined text-[18px]">download</span> Xuất báo cáo
              </button>
              <button
                onClick={openRequest}
                disabled={stats.approvedVal <= 0}
                title={stats.approvedVal <= 0 ? 'Chưa có hoa hồng đã duyệt để rút' : ''}
                className="flex items-center gap-2 rounded-lg bg-[#ff5625] px-4 py-2 text-sm font-bold text-white shadow-lg  active:scale-95 disabled:cursor-not-allowed disabled:bg-[#3d3f41]/50 disabled:text-[#e7eaf0]/40 disabled:shadow-none"
              >
                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span> Yêu cầu tất toán
              </button>
            </div>
          </div>

          {/* Filter */}
          <div className="portal-glass mb-8 grid grid-cols-1 gap-4 rounded-2xl p-4 sm:grid-cols-12 sm:items-end">
            <div className="sm:col-span-3">
              <label className="mb-1.5 ml-1 block text-[11px] uppercase tracking-wider text-[#9ca3af]">Trạng thái</label>
              <div className="relative">
                <select value={filter} onChange={(e) => setFilter(e.target.value as Bucket)} className="w-full cursor-pointer appearance-none rounded-xl border border-[#1f2937]/40 bg-[#1a1c1e] px-4 py-2.5 text-sm text-[#e7eaf0] focus:ring-1 focus:ring-[#ff5625] outline-none">
                  <option value="all">Tất cả trạng thái</option>
                  <option value="pending">Tạm tính / Chờ duyệt</option>
                  <option value="approved">Đã duyệt · chờ chi</option>
                  <option value="paid">Đã thanh toán</option>
                  <option value="rejected">Từ chối / hủy</option>
                </select>
                <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">expand_more</span>
              </div>
            </div>
            <div className="sm:col-span-4">
              <label className="mb-1.5 ml-1 block text-[11px] uppercase tracking-wider text-[#9ca3af]">Khoảng thời gian</label>
              <div className="flex items-center gap-2 rounded-xl border border-[#1f2937]/40 bg-[#1a1c1e] px-3 py-2">
                <span className="material-symbols-outlined text-[18px] text-[#9ca3af]">calendar_today</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full bg-transparent text-sm text-[#e7eaf0] outline-none [color-scheme:dark]" />
                <span className="text-[#9ca3af]">–</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full bg-transparent text-sm text-[#e7eaf0] outline-none [color-scheme:dark]" />
              </div>
            </div>
            <div className="sm:col-span-5">
              <label className="mb-1.5 ml-1 block text-[11px] uppercase tracking-wider text-[#9ca3af]">Tìm kiếm</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[#9ca3af]">search</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm serial / đại lý / khách hàng…" className="w-full rounded-xl border border-[#1f2937]/40 bg-[#1a1c1e] py-2.5 pl-11 pr-4 text-sm text-[#e7eaf0] placeholder:text-[#9ca3af]/40 focus:ring-1 focus:ring-[#ff5625] outline-none" />
              </div>
            </div>
          </div>

          {/* Ledger table */}
          <div className="overflow-hidden rounded-2xl border border-[#1f2937]/40 bg-[#11151a]">
            <div className="portal-scroll overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead>
                  <tr className="border-b border-[#1f2937]/40 bg-[#1a1f26]/50 text-[11px] uppercase tracking-wider text-[#9ca3af]">
                    <th className="px-6 py-4">Số serial</th>
                    <th className="px-6 py-4">Đại lý</th>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-6 py-4 text-right">Giá bán</th>
                    <th className="px-6 py-4">Override</th>
                    <th className="px-6 py-4 text-right">Hoa hồng</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="w-10 px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d3f41]/20">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-[#9ca3af]/60">Không có đơn phù hợp.</td></tr>
                  ) : filtered.map((r) => {
                    const st = statusOf(r);
                    const pct = rateOf(r);
                    const ovr = overrideLabel(pct);
                    const open = openId === r.id;
                    return (
                      <Fragment key={r.id}>
                        <tr onClick={() => setOpenId(open ? null : r.id)} className="group cursor-pointer transition-colors hover:bg-[#1a1f26]">
                          <td className="px-6 py-5 font-mono text-sm text-[#ff5625]">{r.serial_number ?? '—'}</td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ff5625]/15 text-[11px] font-bold text-[#ff5625]">
                                {(r.dealer_name ?? '?').trim().slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium">{r.dealer_name ?? '—'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-sm">{r.customer_name}</td>
                          <td className="px-6 py-5 text-right font-mono text-sm tabular-nums">{fmtVnd(Number(r.sale_price))} ₫</td>
                          <td className="px-6 py-5">
                            <span className={`rounded-md border px-2 py-1 text-[11px] font-bold uppercase ${ovr.cls}`}>{ovr.name}</span>
                          </td>
                          <td className={`px-6 py-5 text-right font-mono text-sm font-bold tabular-nums ${r.commission?.paid_at ? 'text-emerald-400' : 'text-[#e7eaf0]'}`}>
                            {r.commission && !r.commission.voided_at ? `${fmtVnd(Number(r.commission.amount))} ₫` : '—'}
                          </td>
                          <td className="px-6 py-5">
                            <div className={`flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium ${st.cls}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${st.dot} ${st.bucket === 'paid' ? 'animate-pulse' : ''}`} />{st.label}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="material-symbols-outlined text-[#9ca3af] transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>keyboard_arrow_down</span>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-[#06080a]/50">
                            <td colSpan={8} className="px-12 py-6">
                              <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
                                <div className="space-y-1">
                                  <p className="text-[11px] uppercase text-[#9ca3af]">Ngày đặt đơn</p>
                                  <p className="text-sm">{new Date(r.sale_date).toLocaleDateString('vi-VN')}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[11px] uppercase text-[#9ca3af]">Người phụ trách</p>
                                  <p className="text-sm">{r.dealer_name ?? '—'}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[11px] uppercase text-[#9ca3af]">Ngày thanh toán</p>
                                  <p className="text-sm">{r.commission?.paid_at ? new Date(r.commission.paid_at).toLocaleDateString('vi-VN') : 'Chưa chi trả'}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[11px] uppercase text-[#9ca3af]">Mã giao dịch</p>
                                  <p className="font-mono text-sm text-[#ff5625] break-all">{r.commission?.payment_proof_url || '—'}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[#1f2937]/40 bg-[#1a1f26]/20 px-6 py-4">
              <p className="text-sm text-[#9ca3af]">Hiển thị <span className="font-bold text-[#e7eaf0]">{filtered.length}</span> trên <span className="font-bold text-[#e7eaf0]">{rows.length}</span> đơn</p>
            </div>
          </div>

          {myRequests.length > 0 && (
            <div className="mt-10 overflow-hidden rounded-2xl border border-[#1f2937]/40 bg-[#11151a]">
              <div className="border-b border-[#1f2937]/40 px-6 py-4">
                <h2 className="font-headline text-lg">Yêu cầu tất toán của tôi</h2>
                <p className="text-xs text-[#9ca3af]/70">Lịch sử các lần yêu cầu rút override.</p>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-[#9ca3af]">
                  <tr className="border-b border-[#1f2937]/30">
                    <th className="px-6 py-3">Ngày gửi</th>
                    <th className="px-6 py-3 text-right">Số tiền</th>
                    <th className="px-6 py-3">Ghi chú</th>
                    <th className="px-6 py-3">Trạng thái</th>
                    <th className="px-6 py-3">Xử lý</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d3f41]/20">
                  {myRequests.map((req) => (
                    <tr key={req.id}>
                      <td className="px-6 py-3 font-mono text-xs tabular-nums text-[#9ca3af]">{new Date(req.created_at).toLocaleString('vi-VN')}</td>
                      <td className="px-6 py-3 text-right font-mono font-bold tabular-nums">{fmtVnd(Number(req.amount))} ₫</td>
                      <td className="px-6 py-3 text-[#9ca3af]">{req.notes || '—'}</td>
                      <td className="px-6 py-3">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${reqStatusCls[req.status]}`}>{reqStatusLabel[req.status]}</span>
                      </td>
                      <td className="px-6 py-3 text-xs text-[#9ca3af]">{req.processed_at ? new Date(req.processed_at).toLocaleString('vi-VN') : '—'}{req.processor_notes ? ` · ${req.processor_notes}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Edit commission modal: tier auto display + fixed override input */}
      {editingDealer && (() => {
        const curr = currentByDealer[editingDealer.dealer_id];
        const isOverride = curr?.source === 'fixed';
        return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={() => !savingPlan && setEditingDealer(null)}>
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[#1f2937]/60 bg-[#11151a] shadow-2xl  sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#1f2937]/40 px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#10b981]">Hoa hồng đại lý</p>
                <h3 className="mt-1 text-base font-semibold">{editingDealer.dealer_name ?? '(không tên)'}</h3>
              </div>
              <button onClick={() => !savingPlan && setEditingDealer(null)} className="rounded-lg p-1.5 text-[#e7eaf0]/50 hover:bg-[#1a1f26] hover:text-[#e7eaf0]">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
            {/* Tier auto info */}
            <div className="border-b border-[#1f2937]/40 px-5 py-4">
              <p className="text-[10px] uppercase tracking-wider text-[#e7eaf0]/45">Tier tự động (theo số máy năm nay)</p>
              <div className="mt-2 flex items-center justify-between rounded-xl border border-[#1f2937]/40 bg-[#1a1f26]/30 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{curr?.tier_label ?? 'Tier 1 · Cơ bản'}</p>
                  <p className="mt-0.5 text-[11px] text-[#e7eaf0]/50">
                    Đã chốt <span className="font-mono tabular-nums text-[#e7eaf0]/80">{curr?.units_ytd ?? 0}</span> máy năm nay
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-2xl font-bold tabular-nums text-[#10b981]">{Number(curr?.tier_percent ?? 15)}%</p>
                  <p className="text-[10px] text-[#e7eaf0]/40">trên giá bán</p>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-[#e7eaf0]/40">
                Lên 101 máy → 20%. Lên 201 máy → 25%. Tự động cập nhật theo doanh số.
              </p>
            </div>

            {/* Fixed override */}
            <div className="px-5 py-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-[#e7eaf0]/45">Override cố định / máy</p>
                {isOverride && (
                  <span className="rounded-full bg-[#ff5625]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#ff5625]">Đang áp dụng</span>
                )}
              </div>
              <p className="mb-4 text-[11px] text-[#e7eaf0]/50">
                Khi set fixed, mọi đơn của đại lý này = <span className="text-[#e7eaf0]/80">amount × số máy</span> (bỏ qua tier %).
              </p>

              <div className="rounded-xl border border-[#1f2937]/50 bg-[#06080a]/40 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-[#e7eaf0]/45">Số tiền / máy</span>
                  <span className="font-mono text-2xl font-bold tabular-nums text-[#ff5625]">
                    {editAmount.toLocaleString('vi-VN')} <span className="text-base text-[#e7eaf0]/50">₫</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={MIN_FIXED}
                  max={MAX_FIXED}
                  step={STEP_FIXED}
                  value={editAmount}
                  onChange={(e) => setEditAmount(Number(e.target.value))}
                  className="mt-3 w-full accent-[#ff5625]"
                />
                <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-[#e7eaf0]/40">
                  <span>{MIN_FIXED.toLocaleString('vi-VN')} ₫</span>
                  <span>{MAX_FIXED.toLocaleString('vi-VN')} ₫</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[11px] text-[#e7eaf0]/50">Nhập trực tiếp:</span>
                  <input
                    type="number"
                    min={MIN_FIXED}
                    max={MAX_FIXED}
                    step={100000}
                    value={editAmount}
                    onChange={(e) => setEditAmount(Number(e.target.value))}
                    className="flex-1 rounded-lg border border-[#1f2937]/50 bg-[#1a1c1e] px-3 py-1.5 font-mono text-sm tabular-nums text-[#e7eaf0] outline-none focus:border-[#ff5625]"
                  />
                </div>
              </div>
            </div>

            </div>
            <div className="flex flex-wrap gap-2 border-t border-[#1f2937]/40 bg-[#1a1f26]/20 px-5 py-4">
              {isOverride && (
                <button
                  onClick={clearFixedAmount}
                  disabled={savingPlan}
                  className="flex items-center gap-1.5 rounded-lg border border-[#1f2937]/50 px-3 py-2 text-xs font-medium text-[#e7eaf0]/70 hover:border-[#10b981]/40 hover:text-[#10b981] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">backspace</span>
                  Bỏ override, dùng tier auto
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => !savingPlan && setEditingDealer(null)}
                disabled={savingPlan}
                className="rounded-lg border border-[#1f2937]/50 px-4 py-2 text-sm text-[#e7eaf0]/80 hover:bg-[#1a1f26] disabled:opacity-50"
              >
                Huỷ
              </button>
              <button
                onClick={saveFixedAmount}
                disabled={savingPlan || editAmount < MIN_FIXED || editAmount > MAX_FIXED}
                className="rounded-lg bg-[#ff5625] px-5 py-2 text-sm font-bold text-white shadow-lg  hover:bg-[#ff5625]/90 disabled:opacity-50"
              >
                {savingPlan ? 'Đang lưu…' : 'Lưu fixed'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Request payout modal */}
      {reqOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !reqBusy && setReqOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[#1f2937]/40 bg-[#11151a] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-headline text-xl">Yêu cầu tất toán</h3>
            <p className="mt-1 text-sm text-[#9ca3af]">Số dư override đã duyệt: <span className="font-mono font-bold text-emerald-400">{fmtVnd(stats.approvedVal)} ₫</span></p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-[#9ca3af]">Số tiền yêu cầu (₫)</label>
                <input type="number" min={1} max={stats.approvedVal} value={reqAmount} onChange={(e) => setReqAmount(e.target.value)} className="w-full rounded-lg border border-[#1f2937]/50 bg-[#1a1c1e] px-3 py-2 font-mono text-sm tabular-nums text-[#e7eaf0] outline-none focus:border-[#ff5625]" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-[#9ca3af]">Ghi chú (tuỳ chọn)</label>
                <textarea value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-[#1f2937]/50 bg-[#1a1c1e] px-3 py-2 text-sm text-[#e7eaf0] outline-none focus:border-[#ff5625]" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setReqOpen(false)} disabled={reqBusy} className="rounded-lg border border-[#1f2937]/50 px-4 py-2 text-sm text-[#e7eaf0] hover:bg-[#1a1f26]">Huỷ</button>
              <button onClick={submitRequest} disabled={reqBusy} className="rounded-lg bg-[#ff5625] px-5 py-2 text-sm font-bold text-white hover:bg-[#ff5625]/90 disabled:opacity-50">{reqBusy ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
