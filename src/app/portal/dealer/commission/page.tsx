'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { getDealerLedger, createPayoutRequest, getMyPayoutRequests } from '@/lib/portal-queries';
import type { LedgerRow, PayoutRequest } from '@/lib/portal-queries';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

type Bucket = 'all' | 'pending' | 'approved' | 'paid' | 'rejected';

function statusOf(r: LedgerRow): { label: string; cls: string; dot: string; bucket: Exclude<Bucket, 'all'> } {
  if (r.status === 'rejected') return { label: 'Từ chối', cls: 'text-[#ffb4ab] bg-[#ffb4ab]/10 border-[#ffb4ab]/20', dot: 'bg-[#ffb4ab]', bucket: 'rejected' };
  if (r.status === 'voided' || r.commission?.voided_at) return { label: 'Đã hủy', cls: 'text-[#a0a0a8] bg-[#282a2c] border-[#3d3f41]/40', dot: 'bg-[#a0a0a8]', bucket: 'rejected' };
  if (r.commission?.paid_at) return { label: 'Đã thanh toán', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', bucket: 'paid' };
  if (r.commission) return { label: 'Đã duyệt · chờ chi', cls: 'text-[#00daf3] bg-[#00daf3]/10 border-[#00daf3]/20', dot: 'bg-[#00daf3]', bucket: 'approved' };
  if (r.status === 'pending') return { label: 'Chờ duyệt', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', bucket: 'pending' };
  return { label: r.status, cls: 'text-[#a0a0a8] bg-[#282a2c] border-[#3d3f41]/40', dot: 'bg-[#a0a0a8]', bucket: 'pending' };
}

const rateOf = (r: LedgerRow) =>
  r.commission && !r.commission.voided_at && Number(r.sale_price) > 0
    ? Math.round((Number(r.commission.amount) / Number(r.sale_price)) * 100)
    : null;

function planLabel(pct: number | null): { name: string; cls: string } {
  if (pct === null) return { name: 'Tạm tính', cls: 'bg-[#282a2c] text-[#a0a0a8] border-[#3d3f41]/40' };
  if (pct >= 23) return { name: `Vàng ${pct}%`, cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
  if (pct >= 18) return { name: `Bạc ${pct}%`, cls: 'bg-[#00daf3]/10 text-[#00daf3] border-[#00daf3]/20' };
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

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/portal/login'); return; }
    if (profile?.role && profile.role !== 'dealer') { router.replace('/portal'); return; }
    if (profile) {
      getDealerLedger(profile.id).then(setRows);
      getMyPayoutRequests().then(setMyRequests);
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

  if (loading || !session || !profile) return null;

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

  const cards = [
    { key: 'waiting', icon: 'pending_actions', label: 'Tạm tính', val: stats.waitingVal, cnt: stats.waitingCnt, cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    { key: 'pending', icon: 'hourglass_empty', label: 'Chờ duyệt', val: stats.pendingVal, cnt: stats.pendingCnt, cls: 'text-[#00daf3] bg-[#00daf3]/10 border-[#00daf3]/20' },
    { key: 'approved', icon: 'verified', label: 'Đã duyệt · chờ chi', val: stats.approvedVal, cnt: stats.approvedCnt, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { key: 'paid', icon: 'payments', label: 'Đã thanh toán', val: stats.paidVal, cnt: stats.paidCnt, cls: 'text-emerald-500 bg-emerald-600/10 border-emerald-600/20' },
  ];
  const reqStatusCls: Record<PayoutRequest['status'], string> = {
    pending: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    approved: 'text-[#00daf3] bg-[#00daf3]/10 border-[#00daf3]/20',
    rejected: 'text-[#ffb4ab] bg-[#ffb4ab]/10 border-[#ffb4ab]/20',
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
          <p className="mt-1 text-sm text-[#a0a0a8]">Chi tiết hoa hồng theo từng đơn máy và trạng thái thanh toán.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportExcel} className="flex items-center gap-2 rounded-lg border border-[#3d3f41]/40 bg-[#282a2c] px-4 py-2 text-sm font-medium hover:border-[#ff5625]">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Xuất báo cáo
          </button>
          <button onClick={openRequest} className="flex items-center gap-2 rounded-lg bg-[#ff5625] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-[#ff5625]/20 active:scale-95">
            <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            Yêu cầu tất toán
          </button>
        </div>
      </div>

      {/* Filter row */}
      <div className="portal-glass mb-8 grid grid-cols-1 gap-4 rounded-2xl p-4 sm:grid-cols-12 sm:items-end">
        <div className="sm:col-span-3">
          <label className="mb-1.5 ml-1 block text-[11px] uppercase tracking-wider text-[#a0a0a8]">Trạng thái</label>
          <div className="relative">
            <select value={filter} onChange={(e) => setFilter(e.target.value as Bucket)} className="w-full cursor-pointer appearance-none rounded-xl border border-[#3d3f41]/40 bg-[#1a1c1e] px-4 py-2.5 text-sm text-[#e2e2e5] focus:ring-1 focus:ring-[#ff5625] outline-none">
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Tạm tính / Chờ duyệt</option>
              <option value="approved">Đã duyệt · chờ chi</option>
              <option value="paid">Đã thanh toán</option>
              <option value="rejected">Từ chối / hủy</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#a0a0a8]">expand_more</span>
          </div>
        </div>
        <div className="sm:col-span-4">
          <label className="mb-1.5 ml-1 block text-[11px] uppercase tracking-wider text-[#a0a0a8]">Khoảng thời gian</label>
          <div className="flex items-center gap-2 rounded-xl border border-[#3d3f41]/40 bg-[#1a1c1e] px-3 py-2">
            <span className="material-symbols-outlined text-[18px] text-[#a0a0a8]">calendar_today</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full bg-transparent text-sm text-[#e2e2e5] outline-none [color-scheme:dark]" />
            <span className="text-[#a0a0a8]">–</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full bg-transparent text-sm text-[#e2e2e5] outline-none [color-scheme:dark]" />
          </div>
        </div>
        <div className="sm:col-span-5">
          <label className="mb-1.5 ml-1 block text-[11px] uppercase tracking-wider text-[#a0a0a8]">Tìm kiếm</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[#a0a0a8]">search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm số serial / khách hàng…" className="w-full rounded-xl border border-[#3d3f41]/40 bg-[#1a1c1e] py-2.5 pl-11 pr-4 text-sm text-[#e2e2e5] placeholder:text-[#a0a0a8]/40 focus:ring-1 focus:ring-[#ff5625] outline-none" />
          </div>
        </div>
      </div>

      {/* Bento stats */}
      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.key} className="group relative overflow-hidden rounded-2xl border border-[#3d3f41]/20 bg-[#1e2022] p-6">
            <span className="material-symbols-outlined pointer-events-none absolute -bottom-4 -right-4 text-[120px] opacity-[0.04] transition-opacity group-hover:opacity-[0.08]">{c.icon}</span>
            <div className="mb-4 flex items-start justify-between">
              <span className={`material-symbols-outlined rounded-lg border p-2 ${c.cls}`}>{c.icon}</span>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${c.cls}`}>{c.cnt} đơn</span>
            </div>
            <h4 className="text-[11px] uppercase tracking-wider text-[#a0a0a8]">{c.label}</h4>
            <p className="mt-1 font-headline text-[26px] font-bold tabular-nums text-[#e2e2e5]">{fmtVnd(c.val)} ₫</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#3d3f41]/40 bg-[#1e2022]">
        <div className="portal-scroll overflow-x-auto">
          <table className="w-full min-w-[840px] text-left">
            <thead>
              <tr className="border-b border-[#3d3f41]/40 bg-[#282a2c]/50 text-[11px] uppercase tracking-wider text-[#a0a0a8]">
                <th className="px-6 py-4">Số serial</th>
                <th className="px-6 py-4">Khách hàng</th>
                <th className="px-6 py-4 text-right">Giá bán</th>
                <th className="px-6 py-4">Phương án</th>
                <th className="px-6 py-4 text-right">Hoa hồng</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="w-10 px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3d3f41]/20">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-[#a0a0a8]/60">Không có đơn phù hợp.</td></tr>
              ) : filtered.map((r) => {
                const st = statusOf(r);
                const pct = rateOf(r);
                const plan = planLabel(pct);
                const open = openId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr onClick={() => setOpenId(open ? null : r.id)} className="group cursor-pointer transition-colors hover:bg-[#282a2c]">
                      <td className="px-6 py-5 font-mono text-sm text-[#ff5625]">{r.serial_number}</td>
                      <td className="px-6 py-5 text-sm font-semibold">{r.customer_name}</td>
                      <td className="px-6 py-5 text-right font-mono text-sm tabular-nums">{fmtVnd(Number(r.sale_price))} ₫</td>
                      <td className="px-6 py-5">
                        <span className={`rounded-md border px-2 py-1 text-[11px] font-bold uppercase ${plan.cls}`}>{plan.name}</span>
                      </td>
                      <td className={`px-6 py-5 text-right font-mono text-sm font-bold tabular-nums ${r.commission?.paid_at ? 'text-emerald-400' : 'text-[#e2e2e5]'}`}>
                        {r.commission && !r.commission.voided_at ? `${fmtVnd(Number(r.commission.amount))} ₫` : '—'}
                      </td>
                      <td className="px-6 py-5">
                        <div className={`flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium ${st.cls}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot} ${st.bucket === 'paid' ? 'animate-pulse' : ''}`} />{st.label}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="material-symbols-outlined text-[#a0a0a8] transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>keyboard_arrow_down</span>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-[#0c0e10]/50">
                        <td colSpan={7} className="px-12 py-6">
                          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase text-[#a0a0a8]">Ngày đặt đơn</p>
                              <p className="text-sm">{new Date(r.sale_date).toLocaleDateString('vi-VN')}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase text-[#a0a0a8]">Phương án</p>
                              <p className="text-sm">{plan.name}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase text-[#a0a0a8]">Ngày thanh toán</p>
                              <p className="text-sm">{r.commission?.paid_at ? new Date(r.commission.paid_at).toLocaleDateString('vi-VN') : 'Chưa chi trả'}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase text-[#a0a0a8]">Mã giao dịch</p>
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
        <div className="flex items-center justify-between border-t border-[#3d3f41]/40 bg-[#282a2c]/20 px-6 py-4">
          <p className="text-sm text-[#a0a0a8]">Hiển thị <span className="font-bold text-[#e2e2e5]">{filtered.length}</span> trên <span className="font-bold text-[#e2e2e5]">{rows.length}</span> đơn</p>
        </div>
      </div>

      {/* My payout requests */}
      {myRequests.length > 0 && (
        <div className="mt-10 overflow-hidden rounded-2xl border border-[#3d3f41]/40 bg-[#1e2022]">
          <div className="border-b border-[#3d3f41]/40 px-6 py-4">
            <h2 className="font-headline text-lg">Yêu cầu tất toán của tôi</h2>
            <p className="text-xs text-[#a0a0a8]/70">Lịch sử các lần yêu cầu rút hoa hồng đã duyệt.</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-[#a0a0a8]">
              <tr className="border-b border-[#3d3f41]/30">
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
                  <td className="px-6 py-3 font-mono text-xs tabular-nums text-[#a0a0a8]">{new Date(req.created_at).toLocaleString('vi-VN')}</td>
                  <td className="px-6 py-3 text-right font-mono font-bold tabular-nums">{fmtVnd(Number(req.amount))} ₫</td>
                  <td className="px-6 py-3 text-[#a0a0a8]">{req.notes || '—'}</td>
                  <td className="px-6 py-3">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${reqStatusCls[req.status]}`}>{reqStatusLabel[req.status]}</span>
                  </td>
                  <td className="px-6 py-3 text-xs text-[#a0a0a8]">{req.processed_at ? new Date(req.processed_at).toLocaleString('vi-VN') : '—'}{req.processor_notes ? ` · ${req.processor_notes}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payout request modal */}
      {reqOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !reqBusy && setReqOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[#3d3f41]/40 bg-[#1e2022] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-headline text-xl">Yêu cầu tất toán</h3>
            <p className="mt-1 text-sm text-[#a0a0a8]">Số dư đã duyệt chờ chi: <span className="font-mono font-bold text-emerald-400">{fmtVnd(stats.approvedVal)} ₫</span></p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-[#a0a0a8]">Số tiền yêu cầu (₫)</label>
                <input type="number" min={1} max={stats.approvedVal} value={reqAmount} onChange={(e) => setReqAmount(e.target.value)} className="w-full rounded-lg border border-[#3d3f41]/50 bg-[#1a1c1e] px-3 py-2 font-mono text-sm tabular-nums text-[#e2e2e5] outline-none focus:border-[#ff5625]" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wider text-[#a0a0a8]">Ghi chú (tuỳ chọn)</label>
                <textarea value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-[#3d3f41]/50 bg-[#1a1c1e] px-3 py-2 text-sm text-[#e2e2e5] outline-none focus:border-[#ff5625]" placeholder="VD: Cần chi sớm để mua thiết bị" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setReqOpen(false)} disabled={reqBusy} className="rounded-lg border border-[#3d3f41]/50 px-4 py-2 text-sm text-[#e2e2e5] hover:bg-[#282a2c]">Huỷ</button>
              <button onClick={submitRequest} disabled={reqBusy} className="rounded-lg bg-[#ff5625] px-5 py-2 text-sm font-bold text-white hover:bg-[#ff5625]/90 disabled:opacity-50">{reqBusy ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
