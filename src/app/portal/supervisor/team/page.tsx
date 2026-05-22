'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { getDealerSummary, getDealerOrders, getCommissionPlans, setDealerCommission } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import type { Order, DealerSummary, CommissionPlan } from '@/lib/portal-types';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };
const numeric = { fontFamily: 'var(--font-numeric), monospace', fontFeatureSettings: '"tnum"' };
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
      <Link href="/portal/supervisor" className="text-xs text-[#0e1525]/60 hover:text-[#bc7e3b]">← Về đội</Link>
      <h1 style={display} className="mt-3 text-3xl font-light italic">Chi tiết đại lý</h1>
      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Máy YTD</p>
          <p style={numeric} className="mt-2 text-2xl font-medium">{summary?.units_ytd ?? 0}</p>
        </div>
        <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Doanh số tháng</p>
          <p style={numeric} className="mt-2 text-2xl font-medium">{fmtShortVnd(Number(summary?.month_sales ?? 0))}</p>
        </div>
        <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Đơn chờ</p>
          <p style={numeric} className="mt-2 text-2xl font-medium">{summary?.orders_pending ?? 0}</p>
        </div>
        <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Đã chốt</p>
          <p style={numeric} className="mt-2 text-2xl font-medium">{(summary?.orders_approved ?? 0) + (summary?.orders_paid ?? 0)}</p>
        </div>
      </div>
      <div className="mt-8 rounded-2xl border border-[#bc7e3b]/30 bg-[#bc7e3b]/5 p-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#bc7e3b]">Hoa hồng đại lý</p>
        <p className="mt-2 text-sm text-[#0e1525]/70">Chọn một gói hoa hồng có sẵn của hệ thống để áp dụng cho đại lý này.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="rounded-lg border border-[#0e1525]/15 bg-white px-3 py-2 text-sm"
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
            className="rounded-full bg-[#0e1525] px-5 py-2 text-sm font-medium text-[#f5f1e8] hover:bg-[#bc7e3b] disabled:opacity-50"
          >
            {savingPlan ? 'Đang áp dụng…' : 'Áp dụng'}
          </button>
        </div>
      </div>
      <div className="mt-8 overflow-hidden rounded-2xl border border-[#0e1525]/15 bg-white/80">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#0e1525]/15 bg-[#f5f1e8] text-[10px] uppercase tracking-wider text-[#0e1525]/60">
            <tr><th className="px-4 py-3">Serial</th><th className="px-4 py-3">Khách</th><th className="px-4 py-3 text-right">Giá</th><th className="px-4 py-3">Trạng thái</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-[#0e1525]/10">
                <td className="px-4 py-3" style={numeric}>{o.serial_number}</td>
                <td className="px-4 py-3">{o.customer_name}</td>
                <td className="px-4 py-3 text-right" style={numeric}>{fmtShortVnd(o.sale_price)}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-wider text-[#bc7e3b]">{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
