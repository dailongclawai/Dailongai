'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { getDealerSummary, getDealerOrders, getCommissionPlans, setDealerCommission } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import type { Order, DealerSummary, CommissionPlan } from '@/lib/portal-types';

const fmtShortVnd = (n: number) => (n >= 1_000_000 ? (n / 1_000_000).toFixed(1).replace('.0', '') + 'tr' : new Intl.NumberFormat('vi-VN').format(n));

export default function TeamDealerDetail() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [dealerId, setDealerId] = useState('');
  const [summary, setSummary] = useState<DealerSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [plans, setPlans] = useState<CommissionPlan[]>([]);
  const [planId, setPlanId] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  // Query param (not a path segment) so the page works under Next static export.
  useEffect(() => {
    setDealerId(new URLSearchParams(window.location.search).get('dealer') ?? '');
  }, []);

  useEffect(() => {
    if (loading || !dealerId) return;
    if (!session) router.replace('/portal/login');
    else if (profile?.role !== 'supervisor') router.replace('/portal/dashboard');
    else {
      // RLS guarantees supervisor only sees own team's dealer rows; empty = not in team
      getDealerSummary(dealerId).then(setSummary);
      getDealerOrders(dealerId).then(setOrders);
      getCommissionPlans().then(setPlans);
    }
  }, [loading, session, profile, router, dealerId]);

  if (loading || profile?.role !== 'supervisor') return null;

  const applyPlan = async () => {
    if (!planId) {
      toast.error('Chọn một gói hoa hồng');
      return;
    }
    setSavingPlan(true);
    try {
      await setDealerCommission(dealerId, planId);
      toast.success('Đã áp dụng gói hoa hồng cho đại lý');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi áp dụng gói');
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <PortalShell variant="supervisor">
      <Link href="/portal/supervisor" className="text-xs text-[#e2e2e5]/60 hover:text-[#ff5625]">← Về đội</Link>
      <h1 className="mt-3 font-headline text-3xl">Chi tiết đại lý</h1>
      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-[#1e2022] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#e2e2e5]/50">Máy YTD</p>
          <p className="mt-2 font-mono text-2xl font-medium tabular-nums">{summary?.units_ytd ?? 0}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#1e2022] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#e2e2e5]/50">Doanh số tháng</p>
          <p className="mt-2 font-mono text-2xl font-medium tabular-nums">{fmtShortVnd(Number(summary?.month_sales ?? 0))}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#1e2022] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#e2e2e5]/50">Đơn chờ</p>
          <p className="mt-2 font-mono text-2xl font-medium tabular-nums">{summary?.orders_pending ?? 0}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#1e2022] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#e2e2e5]/50">Đã chốt</p>
          <p className="mt-2 font-mono text-2xl font-medium tabular-nums">{(summary?.orders_approved ?? 0) + (summary?.orders_paid ?? 0)}</p>
        </div>
      </div>
      <div className="mt-8 rounded-2xl border border-[#ff5625]/30 bg-[#ff5625]/5 p-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Hoa hồng đại lý</p>
        <p className="mt-2 text-sm text-[#e2e2e5]/70">Chọn một gói hoa hồng có sẵn của hệ thống để áp dụng cho đại lý này.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="rounded-lg border border-white/15 bg-[#1e2022] px-3 py-2 text-sm text-[#e2e2e5] focus:border-[#ff5625]"
          >
            <option value="">— Chọn gói hoa hồng —</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            onClick={applyPlan}
            disabled={savingPlan}
            className="rounded-full bg-[#ff5625] px-5 py-2 text-sm font-medium text-white glow-primary-hover hover:bg-[#ff8a5c] disabled:opacity-50"
          >
            {savingPlan ? 'Đang áp dụng…' : 'Áp dụng'}
          </button>
        </div>
      </div>
      <div className="mt-8 overflow-hidden rounded-2xl border border-white/12 bg-[#1e2022]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/12 bg-white/5 text-[10px] uppercase tracking-wider text-[#e2e2e5]/60">
            <tr><th className="px-4 py-3">Serial</th><th className="px-4 py-3">Khách</th><th className="px-4 py-3 text-right">Giá</th><th className="px-4 py-3">Trạng thái</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-white/10">
                <td className="px-4 py-3 font-mono tabular-nums">{o.serial_number}</td>
                <td className="px-4 py-3">{o.customer_name}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtShortVnd(o.sale_price)}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-wider text-[#ff5625]">{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
