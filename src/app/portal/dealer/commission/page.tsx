'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { DailyOrdersChart } from '@/components/portal/DailyOrdersChart';
import { PortalSkeleton } from '@/components/portal/PortalSkeleton';
import { Spinner } from '@/components/portal/Spinner';
import { getDealerLedger, createPayoutRequest, getMyPayoutRequests } from '@/lib/portal-queries';
import type { LedgerRow, PayoutRequest } from '@/lib/portal-queries';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

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
    ? Math.round((Number(r.commission.amount) / Number(r.sale_price)) * 100)
    : null;

function planLabel(pct: number | null): { name: string; cls: string } {
  if (pct === null) return { name: 'Tạm tính', cls: 'bg-[#1a1f26] text-[#9ca3af] border-[#1f2937]/40' };
  if (pct >= 23) return { name: `Vàng ${pct}%`, cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
  if (pct >= 18) return { name: `Bạc ${pct}%`, cls: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20' };
  return { name: `Cơ bản ${pct}%`, cls: 'bg-[#ff5625]/10 text-[#ff5625] border-[#ff5625]/20' };
}

export default function DealerCommissionPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [rows, setRows] = useState<LedgerRow[]>([]);
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
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/portal/login'); return; }
    if (profile?.role && profile.role !== 'dealer') { router.replace('/portal/403'); return; }
    if (profile) {
      setFetching(true);
      Promise.all([getDealerLedger(profile.id), getMyPayoutRequests()])
        .then(([ledger, reqs]) => {
          setRows(ledger);
          setMyRequests(reqs);
        })
        .finally(() => setFetching(false));
    }
  }, [loading, session, profile, router]);

  const stats = useMemo(() => {
    let pendingCnt = 0, pendingVal = 0;        // chờ duyệt: order pending, no commission yet (estimated)
    let waitingCnt = 0, waitingVal = 0;        // tạm tính: same orders, estimated commission at 15%
    let approvedCnt = 0, approvedVal = 0;      // đã duyệt · chờ chi
    let paidCnt = 0, paidVal = 0;              // đã thanh toán
    for (const r of rows) {
      const c = r.commission;
      if (c?.paid_at && !c.voided_at) { paidCnt++; paidVal += Number(c.amount); continue; }
      if (c && !c.voided_at) { approvedCnt++; approvedVal += Number(c.amount); continue; }
      if (r.status === 'pending') {
        pendingCnt++; pendingVal += Number(r.sale_price);
        waitingCnt++; waitingVal += Math.round(Number(r.sale_price) * 0.15);
      }
    }
    return { pendingCnt, pendingVal, waitingCnt, waitingVal, approvedCnt, approvedVal, paidCnt, paidVal };
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    const b = statusOf(r).bucket;
    if (filter !== 'all' && b !== filter) return false;
    if (q && !(`${r.serial_number} ${r.customer_name}`.toLowerCase().includes(q.toLowerCase()))) return false;
    if (from && r.sale_date < from) return false;
    if (to && r.sale_date > to) return false;
    return true;
  }), [rows, filter, q, from, to]);

  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, LedgerRow[]>();
    for (const r of filtered) {
      const key = (r.sale_date || '').slice(0, 7) || 'unknown';
      const list = groups.get(key);
      if (list) list.push(r); else groups.set(key, [r]);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) => {
        const sold = items
          .filter((r) => r.commission && !r.commission.voided_at)
          .reduce((s, r) => s + Number(r.commission?.amount ?? 0), 0);
        return { key, items, sold, count: items.length };
      });
  }, [filtered]);

  const monthLabel = (key: string) => {
    if (key === 'unknown') return 'Không xác định';
    const [y, m] = key.split('-');
    return `Tháng ${m}/${y}`;
  };

  if (loading || !session || !profile) return (
    <PortalShell variant="dealer">
      <PortalSkeleton.Ledger />
    </PortalShell>
  );

  const exportExcel = () => {
    if (filtered.length === 0) { toast.error('Không có đơn để xuất'); return; }
    const data = filtered.map((r) => {
      const pct = rateOf(r);
      const st = statusOf(r);
      return {
        'Số serial': r.serial_number,
        'Khách hàng': r.customer_name,
        'Giá bán (₫)': Number(r.sale_price),
        'Phương án': planLabel(pct).name,
        'Hoa hồng (₫)': r.commission && !r.commission.voided_at ? Number(r.commission.amount) : '',
        'Trạng thái': st.label,
        'Ngày đặt': r.sale_date,
        'Ngày thanh toán': r.commission?.paid_at ?? '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sổ hoa hồng');
    XLSX.writeFile(wb, `hoa-hong-${profile.full_name || 'daily'}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Đã xuất ${filtered.length} đơn`);
  };

  const openRequest = () => {
    if (stats.approvedVal <= 0) {
      toast.error('Chưa có hoa hồng đã duyệt để yêu cầu tất toán');
      return;
    }
    setReqAmount(String(stats.approvedVal));
    setReqNotes('');
    setReqOpen(true);
  };

  const submitRequest = async () => {
    const amt = Number(reqAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Số tiền không hợp lệ'); return; }
    if (amt > stats.approvedVal) { toast.error('Vượt số dư đã duyệt chờ chi'); return; }
    setReqBusy(true);
    try {
      await createPayoutRequest(amt, 'dealer', reqNotes.trim() || undefined);
      toast.success('Đã gửi yêu cầu tất toán');
      setReqOpen(false);
      setMyRequests(await getMyPayoutRequests());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không gửi được yêu cầu');
    } finally {
      setReqBusy(false);
    }
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

  return (
    <PortalShell variant="dealer">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Minh bạch hoa hồng</p>
          <h1 className="mt-1 font-headline text-3xl">Sổ hoa hồng</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">Chi tiết hoa hồng theo từng đơn máy và trạng thái thanh toán.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportExcel} className="flex items-center gap-2 rounded-lg border border-[#1f2937]/40 bg-[#1a1f26] px-4 py-2 text-sm font-medium hover:border-[#ff5625]">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Xuất báo cáo
          </button>
          <button
            onClick={openRequest}
            disabled={stats.approvedVal <= 0}
            title={stats.approvedVal <= 0 ? 'Chưa có hoa hồng đã duyệt để rút' : ''}
            className="flex items-center gap-2 rounded-lg bg-[#ff5625] px-4 py-2 text-sm font-bold text-white shadow-lg  active:scale-95 disabled:cursor-not-allowed disabled:bg-[#3d3f41]/50 disabled:text-[#e7eaf0]/40 disabled:shadow-none"
          >
            <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            Yêu cầu tất toán
          </button>
        </div>
      </div>

      {/* Filter row */}
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm số serial / khách hàng…" className="w-full rounded-xl border border-[#1f2937]/40 bg-[#1a1c1e] py-2.5 pl-11 pr-4 text-sm text-[#e7eaf0] placeholder:text-[#9ca3af]/40 focus:ring-1 focus:ring-[#ff5625] outline-none" />
          </div>
        </div>
      </div>

      {/* Daily orders chart — số đơn + doanh số theo ngày (chỉ đơn đã thành công) */}
      <div className="mb-8">
        <DailyOrdersChart rows={rows} days={30} title="Doanh số theo ngày" />
      </div>

      {/* Grouped commission timeline (replaces flat table) */}
      {fetching ? (
        <PortalSkeleton.Ledger />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1f2937] bg-[#11151a] p-10 text-center text-sm text-[#9ca3af]">
          Không có đơn phù hợp với bộ lọc.
        </div>
      ) : (
        <div className="space-y-8">
          {groupedByMonth.map((group) => (
            <section key={group.key}>
              <header className="sticky top-[64px] z-10 -mx-2 mb-3 flex items-baseline justify-between gap-3 rounded-md bg-[#0a0c0f]/95 px-2 py-2 backdrop-blur">
                <h3 className="font-headline text-lg text-[#e7eaf0]">{monthLabel(group.key)}</h3>
                <p className="text-xs text-[#9ca3af]">
                  <span className="font-mono font-semibold tabular-nums text-[#ff5625]">{fmtVnd(group.sold)} ₫</span>
                  {' · '}
                  <span className="font-mono tabular-nums">{group.count}</span> đơn
                </p>
              </header>
              <ul className="space-y-3">
                {group.items.map((r) => {
                  const st = statusOf(r);
                  const pct = rateOf(r);
                  const plan = planLabel(pct);
                  const open = openId === r.id;
                  const commissionAmount = r.commission && !r.commission.voided_at ? Number(r.commission.amount) : null;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : r.id)}
                        className="w-full rounded-2xl border border-[#1f2937] bg-[#11151a] p-4 text-left transition-colors hover:border-[#ff5625]/40 hover:bg-[#1a1f26] active:scale-[0.998]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[#e7eaf0] truncate">{r.customer_name}</p>
                            <p className="mt-0.5 text-xs text-[#9ca3af]">
                              <span className="font-mono tabular-nums">{new Date(r.sale_date).toLocaleDateString('vi-VN')}</span>
                              {' · '}
                              <span className="font-mono tabular-nums text-[#ff5625]">{r.serial_number}</span>
                            </p>
                          </div>
                          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${st.cls}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${st.dot} ${st.bucket === 'paid' ? 'animate-pulse' : ''}`} />
                            {st.label}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">Giá bán</p>
                            <p className="font-headline text-lg tabular-nums">{fmtVnd(Number(r.sale_price))} ₫</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">Hoa hồng</p>
                            <p className={`font-headline text-lg tabular-nums ${commissionAmount && r.commission?.paid_at ? 'text-[#10b981]' : commissionAmount ? 'text-[#3b82f6]' : 'text-[#9ca3af]'}`}>
                              {commissionAmount !== null ? `${fmtVnd(commissionAmount)} ₫` : '—'}
                            </p>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">Phương án</p>
                            <span className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${plan.cls}`}>{plan.name}</span>
                          </div>
                        </div>
                        {open && (
                          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[#1f2937] pt-4 sm:grid-cols-4">
                            <div>
                              <p className="text-[10px] uppercase text-[#9ca3af]">Ngày đặt</p>
                              <p className="text-sm">{new Date(r.sale_date).toLocaleDateString('vi-VN')}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase text-[#9ca3af]">Phương án</p>
                              <p className="text-sm">{plan.name}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase text-[#9ca3af]">Ngày thanh toán</p>
                              <p className="text-sm">{r.commission?.paid_at ? new Date(r.commission.paid_at).toLocaleDateString('vi-VN') : 'Chưa chi trả'}</p>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <p className="text-[10px] uppercase text-[#9ca3af]">Mã giao dịch</p>
                              <p className="font-mono text-xs text-[#ff5625] break-all">{r.commission?.payment_proof_url || '—'}</p>
                            </div>
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <p className="px-2 text-xs text-[#9ca3af]">
            Hiển thị <span className="font-mono font-semibold tabular-nums text-[#e7eaf0]">{filtered.length}</span> trên{' '}
            <span className="font-mono font-semibold tabular-nums text-[#e7eaf0]">{rows.length}</span> đơn.
          </p>
        </div>
      )}

      {/* My payout requests */}
      {myRequests.length > 0 && (
        <div className="mt-10 overflow-hidden rounded-2xl border border-[#1f2937]/40 bg-[#11151a]">
          <div className="border-b border-[#1f2937]/40 px-6 py-4">
            <h2 className="font-headline text-lg">Yêu cầu tất toán của tôi</h2>
            <p className="text-xs text-[#9ca3af]/70">Lịch sử các lần yêu cầu rút hoa hồng đã duyệt.</p>
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

      {/* Payout request modal */}
      {reqOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !reqBusy && setReqOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[#1f2937]/40 bg-[#11151a] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-headline text-xl">Yêu cầu tất toán</h3>
            <p className="mt-1 text-sm text-[#9ca3af]">Số dư đã duyệt chờ chi: <span className="font-mono font-bold text-emerald-400">{fmtVnd(stats.approvedVal)} ₫</span></p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-[#9ca3af]">Số tiền yêu cầu (₫)</label>
                <input type="number" min={1} max={stats.approvedVal} value={reqAmount} onChange={(e) => setReqAmount(e.target.value)} className="w-full rounded-lg border border-[#1f2937]/50 bg-[#1a1c1e] px-3 py-2 font-mono text-sm tabular-nums text-[#e7eaf0] outline-none focus:border-[#ff5625]" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-[#9ca3af]">Ghi chú (tuỳ chọn)</label>
                <textarea value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-[#1f2937]/50 bg-[#1a1c1e] px-3 py-2 text-sm text-[#e7eaf0] outline-none focus:border-[#ff5625]" placeholder="VD: Cần chi sớm để mua thiết bị" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setReqOpen(false)} disabled={reqBusy} className="rounded-lg border border-[#1f2937]/50 px-4 py-2 text-sm text-[#e7eaf0] hover:bg-[#1a1f26]">Huỷ</button>
              <button onClick={submitRequest} disabled={reqBusy} className="inline-flex items-center gap-2 rounded-lg bg-[#ff5625] px-5 py-2 text-sm font-bold text-white hover:bg-[#ff5625]/90 disabled:opacity-50">
                {reqBusy && <Spinner size={14} />}
                {reqBusy ? 'Đang gửi…' : 'Gửi yêu cầu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
