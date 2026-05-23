'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { getDealerSummary, getDealerOrders, getDealerCurrentCommissions, setDealerFixedCommission, clearDealerFixedCommission } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import type { Order, DealerSummary, DealerCurrentCommission } from '@/lib/portal-types';

const MIN_FIXED = 4500000;
const MAX_FIXED = 12000000;
const STEP_FIXED = 500000;

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

export default function TeamDealerDetail() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [dealerId, setDealerId] = useState('');
  const [summary, setSummary] = useState<DealerSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentCommission, setCurrentCommission] = useState<DealerCurrentCommission | null>(null);
  const [amount, setAmount] = useState(6000000);
  const [savingPlan, setSavingPlan] = useState(false);

  // Query param (not a path segment) so the page works under Next static export.
  useEffect(() => {
    setDealerId(new URLSearchParams(window.location.search).get('dealer') ?? '');
  }, []);

  useEffect(() => {
    if (loading || !dealerId) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'supervisor') router.replace('/portal/403');
    else {
      // RLS guarantees supervisor only sees own team's dealer rows; empty = not in team
      getDealerSummary(dealerId).then(setSummary);
      getDealerOrders(dealerId).then(setOrders);
      getDealerCurrentCommissions([dealerId]).then((m) => {
        const c = m[dealerId];
        setCurrentCommission(c ?? null);
        if (c?.override_amount) setAmount(Number(c.override_amount));
      });
    }
  }, [loading, session, profile, router, dealerId]);

  if (loading || profile?.role !== 'supervisor') return null;

  const refreshCommission = async () => {
    const m = await getDealerCurrentCommissions([dealerId]);
    setCurrentCommission(m[dealerId] ?? null);
  };

  const saveFixed = async () => {
    if (amount < MIN_FIXED || amount > MAX_FIXED) {
      toast.error(`Số tiền phải từ ${MIN_FIXED.toLocaleString('vi-VN')} đến ${MAX_FIXED.toLocaleString('vi-VN')} đ`);
      return;
    }
    setSavingPlan(true);
    try {
      await setDealerFixedCommission(dealerId, amount);
      await refreshCommission();
      toast.success('Đã set hoa hồng cố định');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi set hoa hồng');
    } finally { setSavingPlan(false); }
  };

  const clearFixed = async () => {
    setSavingPlan(true);
    try {
      await clearDealerFixedCommission(dealerId);
      await refreshCommission();
      toast.success('Đã chuyển về tier auto');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi xoá override');
    } finally { setSavingPlan(false); }
  };

  return (
    <PortalShell variant="supervisor">
      <Link href="/portal/supervisor" className="text-xs text-[#e7eaf0]/60 hover:text-[#ff5625]">← Về đội</Link>
      <h1 className="mt-3 font-headline text-3xl">Chi tiết đại lý</h1>
      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">Máy YTD</p>
          <p className="mt-2 font-mono text-2xl font-medium tabular-nums">{summary?.units_ytd ?? 0}</p>
        </div>
        <div className="rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">Doanh số tháng</p>
          <p className="mt-2 font-mono text-2xl font-medium tabular-nums">{fmtVnd(Number(summary?.month_sales ?? 0))}</p>
        </div>
        <div className="rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">Đơn chờ</p>
          <p className="mt-2 font-mono text-2xl font-medium tabular-nums">{summary?.orders_pending ?? 0}</p>
        </div>
        <div className="rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">Đã chốt</p>
          <p className="mt-2 font-mono text-2xl font-medium tabular-nums">{(summary?.orders_approved ?? 0) + (summary?.orders_paid ?? 0)}</p>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Tier auto */}
        <div className="rounded-2xl border border-[#10b981]/30 bg-[#10b981]/5 p-6">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#10b981]">Tier tự động</p>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="font-headline text-xl">{currentCommission?.tier_label ?? 'Tier 1 · Cơ bản'}</p>
              <p className="mt-1 text-[11px] text-[#e7eaf0]/50">
                Đã chốt <span className="font-mono tabular-nums text-[#e7eaf0]/80">{currentCommission?.units_ytd ?? 0}</span> máy năm nay
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-3xl font-bold tabular-nums text-[#10b981]">{Number(currentCommission?.tier_percent ?? 15)}%</p>
              <p className="text-[10px] text-[#e7eaf0]/40">trên giá bán</p>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-[#e7eaf0]/40">101 máy → 20% · 201 máy → 25%. Tự động cập nhật.</p>
        </div>

        {/* Fixed override */}
        <div className="rounded-2xl border border-[#ff5625]/30 bg-[#ff5625]/5 p-6">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Override cố định / máy</p>
            {currentCommission?.source === 'fixed' && (
              <span className="rounded-full bg-[#ff5625]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#ff5625]">Đang áp dụng</span>
            )}
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-[11px] text-[#e7eaf0]/50">Số tiền / máy</span>
            <span className="font-mono text-2xl font-bold tabular-nums text-[#ff5625]">
              {amount.toLocaleString('vi-VN')} <span className="text-base text-[#e7eaf0]/50">₫</span>
            </span>
          </div>
          <input
            type="range"
            min={MIN_FIXED} max={MAX_FIXED} step={STEP_FIXED}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="mt-2 w-full accent-[#ff5625]"
          />
          <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-[#e7eaf0]/40">
            <span>{MIN_FIXED.toLocaleString('vi-VN')} ₫</span>
            <span>{MAX_FIXED.toLocaleString('vi-VN')} ₫</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              min={MIN_FIXED} max={MAX_FIXED} step={100000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="flex-1 rounded-lg border border-[#1f2937]/50 bg-[#1a1c1e] px-3 py-1.5 font-mono text-sm tabular-nums text-[#e7eaf0] outline-none focus:border-[#ff5625]"
            />
            <button
              onClick={saveFixed}
              disabled={savingPlan || amount < MIN_FIXED || amount > MAX_FIXED}
              className="rounded-lg bg-[#ff5625] px-4 py-2 text-xs font-bold text-white shadow-lg  hover:bg-[#ff5625]/90 disabled:opacity-50"
            >
              {savingPlan ? '...' : 'Lưu fixed'}
            </button>
          </div>
          {currentCommission?.source === 'fixed' && (
            <button
              onClick={clearFixed}
              disabled={savingPlan}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#1f2937]/50 px-3 py-2 text-[11px] text-[#e7eaf0]/70 hover:border-[#10b981]/40 hover:text-[#10b981] disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[14px]">backspace</span>
              Bỏ override, dùng tier auto
            </button>
          )}
        </div>
      </div>
      <div className="mt-8 overflow-hidden rounded-2xl border border-[#1f2937]/40 bg-[#11151a]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#1f2937]/40 bg-[#1a1f26]/40 text-[10px] uppercase tracking-wider text-[#e7eaf0]/60">
            <tr><th className="px-4 py-3">Serial</th><th className="px-4 py-3">Khách</th><th className="px-4 py-3 text-right">Giá</th><th className="px-4 py-3">Trạng thái</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-[#1f2937]/40">
                <td className="px-4 py-3 font-mono tabular-nums">{o.serial_number}</td>
                <td className="px-4 py-3">{o.customer_name}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtVnd(o.sale_price)}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-wider text-[#ff5625]">{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
