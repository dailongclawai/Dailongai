'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PortalShell } from '@/components/portal/PortalShell';
import { getDealerLedger } from '@/lib/portal-queries';
import type { LedgerRow } from '@/lib/portal-queries';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

type Bucket = 'all' | 'pending' | 'approved' | 'paid' | 'rejected';

function statusOf(r: LedgerRow): { label: string; cls: string; bucket: Exclude<Bucket, 'all'> } {
  if (r.status === 'rejected') return { label: 'Từ chối', cls: 'text-[#ffb4ab] bg-[#ffb4ab]/10 border-[#ffb4ab]/20', bucket: 'rejected' };
  if (r.status === 'voided' || r.commission?.voided_at) return { label: 'Đã hủy', cls: 'text-[#e4beb4] bg-[#372621] border-[#5b4039]/40', bucket: 'rejected' };
  if (r.commission?.paid_at) return { label: 'Đã thanh toán', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', bucket: 'paid' };
  if (r.commission) return { label: 'Đã duyệt · chờ chi', cls: 'text-[#84cfff] bg-[#84cfff]/10 border-[#84cfff]/20', bucket: 'approved' };
  if (r.status === 'pending') return { label: 'Chờ duyệt', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20', bucket: 'pending' };
  return { label: r.status, cls: 'text-[#e4beb4] bg-[#372621] border-[#5b4039]/40', bucket: 'pending' };
}

const rate = (r: LedgerRow) =>
  r.commission && !r.commission.voided_at && Number(r.sale_price) > 0
    ? Math.round((Number(r.commission.amount) / Number(r.sale_price)) * 100)
    : null;

export default function DealerCommissionPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [filter, setFilter] = useState<Bucket>('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/portal/login'); return; }
    if (profile?.role && profile.role !== 'dealer') { router.replace('/portal'); return; }
    if (profile) getDealerLedger(profile.id).then(setRows);
  }, [loading, session, profile, router]);

  const stats = useMemo(() => {
    const sum = (pred: (r: LedgerRow) => boolean, val: (r: LedgerRow) => number) =>
      rows.filter(pred).reduce((s, r) => s + val(r), 0);
    const cnt = (pred: (r: LedgerRow) => boolean) => rows.filter(pred).length;
    const isPaid = (r: LedgerRow) => !!r.commission?.paid_at;
    const isApproved = (r: LedgerRow) => !!r.commission && !r.commission.paid_at && !r.commission.voided_at;
    const isPending = (r: LedgerRow) => r.status === 'pending';
    return {
      pendingCnt: cnt(isPending), pendingVal: sum(isPending, (r) => Number(r.sale_price)),
      approvedCnt: cnt(isApproved), approvedVal: sum(isApproved, (r) => Number(r.commission!.amount)),
      paidCnt: cnt(isPaid), paidVal: sum(isPaid, (r) => Number(r.commission!.amount)),
      accruedCnt: cnt((r) => !!r.commission && !r.commission.voided_at), accruedVal: sum((r) => !!r.commission && !r.commission.voided_at, (r) => Number(r.commission!.amount)),
    };
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    const b = statusOf(r).bucket;
    if (filter !== 'all' && b !== filter) return false;
    if (q && !(`${r.serial_number} ${r.customer_name}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  }), [rows, filter, q]);

  if (loading || !session || !profile) return null;

  const cards = [
    { key: 'pending', icon: 'pending_actions', tone: 'amber', label: 'Tạm tính / chờ duyệt', cnt: stats.pendingCnt, val: stats.pendingVal },
    { key: 'approved', icon: 'hourglass_empty', tone: 'cyan', label: 'Đã duyệt · chờ chi', cnt: stats.approvedCnt, val: stats.approvedVal },
    { key: 'paid', icon: 'payments', tone: 'emerald', label: 'Đã thanh toán', cnt: stats.paidCnt, val: stats.paidVal },
    { key: 'accrued', icon: 'savings', tone: 'peach', label: 'Tổng hoa hồng phát sinh', cnt: stats.accruedCnt, val: stats.accruedVal },
  ];
  const toneCls: Record<string, string> = {
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    cyan: 'text-[#84cfff] bg-[#84cfff]/10 border-[#84cfff]/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    peach: 'text-[#ffb5a1] bg-[#ffb5a1]/10 border-[#ffb5a1]/20',
  };

  return (
    <PortalShell variant="dealer">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ffb5a1]">Minh bạch hoa hồng</p>
          <h1 className="mt-1 font-headline text-3xl">Sổ hoa hồng</h1>
          <p className="mt-1 text-sm text-[#e4beb4]">Chi tiết hoa hồng theo từng đơn máy và trạng thái thanh toán.</p>
        </div>
      </div>

      {/* Filter row */}
      <div className="portal-glass mb-8 grid grid-cols-1 gap-4 rounded-2xl p-4 sm:grid-cols-12 sm:items-end">
        <div className="sm:col-span-4">
          <label className="mb-1.5 ml-1 block text-[11px] uppercase tracking-wider text-[#e4beb4]">Trạng thái</label>
          <div className="relative">
            <select value={filter} onChange={(e) => setFilter(e.target.value as Bucket)} className="w-full cursor-pointer appearance-none rounded-xl border border-[#5b4039]/40 bg-[#271814] px-4 py-2.5 text-sm text-[#fadcd5] focus:ring-1 focus:ring-[#ffb5a1] outline-none">
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt · chờ chi</option>
              <option value="paid">Đã thanh toán</option>
              <option value="rejected">Từ chối / hủy</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#e4beb4]">expand_more</span>
          </div>
        </div>
        <div className="sm:col-span-8">
          <label className="mb-1.5 ml-1 block text-[11px] uppercase tracking-wider text-[#e4beb4]">Tìm kiếm</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[#e4beb4]">search</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm số serial / khách hàng…" className="w-full rounded-xl border border-[#5b4039]/40 bg-[#271814] py-2.5 pl-11 pr-4 text-sm text-[#fadcd5] placeholder:text-[#e4beb4]/40 focus:ring-1 focus:ring-[#ffb5a1] outline-none" />
          </div>
        </div>
      </div>

      {/* Bento stats */}
      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.key} className="group relative overflow-hidden rounded-2xl border border-[#5b4039]/20 bg-[#2c1c17] p-6">
            <span className="material-symbols-outlined pointer-events-none absolute -bottom-4 -right-4 text-[120px] opacity-[0.04] transition-opacity group-hover:opacity-[0.08]">{c.icon}</span>
            <div className="mb-4 flex items-start justify-between">
              <span className={`material-symbols-outlined rounded-lg border p-2 ${toneCls[c.tone]}`}>{c.icon}</span>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${toneCls[c.tone]}`}>{c.cnt} đơn</span>
            </div>
            <h4 className="text-[11px] uppercase tracking-wider text-[#e4beb4]">{c.label}</h4>
            <p className="mt-1 font-headline text-[26px] font-bold tabular-nums text-[#fadcd5]">{fmtVnd(c.val)} ₫</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#5b4039]/40 bg-[#2c1c17]">
        <div className="portal-scroll overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-[#5b4039]/40 bg-[#372621]/50 text-[11px] uppercase tracking-wider text-[#e4beb4]">
                <th className="px-6 py-4">Số serial</th>
                <th className="px-6 py-4">Khách hàng</th>
                <th className="px-6 py-4 text-right">Giá bán</th>
                <th className="px-6 py-4 text-center">Tỷ lệ</th>
                <th className="px-6 py-4 text-right">Hoa hồng</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="w-10 px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#5b4039]/20">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-[#e4beb4]/60">Không có đơn phù hợp.</td></tr>
              ) : filtered.map((r) => {
                const st = statusOf(r);
                const pct = rate(r);
                const open = openId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr onClick={() => setOpenId(open ? null : r.id)} className="group cursor-pointer transition-colors hover:bg-[#372621]">
                      <td className="px-6 py-5 font-mono text-sm text-[#ffb5a1]">{r.serial_number}</td>
                      <td className="px-6 py-5 text-sm font-semibold">{r.customer_name}</td>
                      <td className="px-6 py-5 text-right font-mono text-sm tabular-nums">{fmtVnd(Number(r.sale_price))} ₫</td>
                      <td className="px-6 py-5 text-center">
                        {pct !== null ? <span className="rounded-md border border-[#ffb5a1]/20 bg-[#ffb5a1]/10 px-2 py-1 text-[11px] font-bold text-[#ffb5a1]">{pct}%</span> : <span className="text-[#e4beb4]/40">—</span>}
                      </td>
                      <td className={`px-6 py-5 text-right font-mono text-sm font-bold tabular-nums ${r.commission?.paid_at ? 'text-emerald-400' : 'text-[#fadcd5]'}`}>
                        {r.commission && !r.commission.voided_at ? `${fmtVnd(Number(r.commission.amount))} ₫` : '—'}
                      </td>
                      <td className="px-6 py-5">
                        <div className={`flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium ${st.cls}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />{st.label}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="material-symbols-outlined text-[#e4beb4] transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>keyboard_arrow_down</span>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-[#180b07]/50">
                        <td colSpan={7} className="px-12 py-6">
                          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase text-[#e4beb4]">Ngày đặt đơn</p>
                              <p className="text-sm">{new Date(r.sale_date).toLocaleDateString('vi-VN')}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase text-[#e4beb4]">Trạng thái</p>
                              <p className="text-sm">{st.label}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase text-[#e4beb4]">Ngày thanh toán</p>
                              <p className="text-sm">{r.commission?.paid_at ? new Date(r.commission.paid_at).toLocaleDateString('vi-VN') : 'Chưa chi trả'}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase text-[#e4beb4]">Mã giao dịch</p>
                              <p className="font-mono text-sm text-[#ffb5a1]">{r.commission?.payment_proof_url || '—'}</p>
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
        <div className="flex items-center justify-between border-t border-[#5b4039]/40 bg-[#372621]/20 px-6 py-4">
          <p className="text-sm text-[#e4beb4]">Hiển thị <span className="font-bold text-[#fadcd5]">{filtered.length}</span> trên <span className="font-bold text-[#fadcd5]">{rows.length}</span> đơn</p>
        </div>
      </div>
    </PortalShell>
  );
}
