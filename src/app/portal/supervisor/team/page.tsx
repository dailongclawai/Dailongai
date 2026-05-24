'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getDealerSummary, getDealerOrders, getDealerCurrentCommissions, setDealerFixedCommission, clearDealerFixedCommission } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import type { Order, DealerSummary, DealerCurrentCommission } from '@/lib/portal-types';

const MIN_FIXED = 4500000;
const MAX_FIXED = 12000000;
const STEP_FIXED = 500000;

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

export default function TeamDealerDetail() {
  const router = useRouter();
  const { t } = useI18n();
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
      toast.error(`${t('portal.supervisor.team.toast.amount_range_prefix')} ${MIN_FIXED.toLocaleString('vi-VN')} ${t('portal.supervisor.team.toast.amount_range_to')} ${MAX_FIXED.toLocaleString('vi-VN')} ${t('portal.supervisor.team.toast.amount_range_suffix')}`);
      return;
    }
    setSavingPlan(true);
    try {
      await setDealerFixedCommission(dealerId, amount);
      await refreshCommission();
      toast.success(t('portal.supervisor.team.toast.fixed_set'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('portal.supervisor.team.toast.fixed_set_error'));
    } finally { setSavingPlan(false); }
  };

  const clearFixed = async () => {
    setSavingPlan(true);
    try {
      await clearDealerFixedCommission(dealerId);
      await refreshCommission();
      toast.success(t('portal.supervisor.team.toast.tier_restored'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('portal.supervisor.team.toast.tier_restore_error'));
    } finally { setSavingPlan(false); }
  };

  return (
    <PortalShell variant="supervisor">
      <Link href="/portal/supervisor" className="text-xs text-[#e7eaf0]/60 hover:text-[#ff5625]">{t('portal.supervisor.team.back_to_team')}</Link>
      <h1 className="mt-3 font-headline text-3xl">{t('portal.supervisor.team.heading')}</h1>
      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">{t('portal.supervisor.team.stat.units_month')}</p>
          <p className="mt-2 font-mono text-2xl font-medium tabular-nums">{summary?.units_ytd ?? 0}</p>
        </div>
        <div className="rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">{t('portal.supervisor.team.stat.month_sales')}</p>
          <p className="mt-2 font-mono text-2xl font-medium tabular-nums">{fmtVnd(Number(summary?.month_sales ?? 0))}</p>
        </div>
        <div className="rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">{t('portal.supervisor.team.stat.orders_pending')}</p>
          <p className="mt-2 font-mono text-2xl font-medium tabular-nums">{summary?.orders_pending ?? 0}</p>
        </div>
        <div className="rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">{t('portal.supervisor.team.stat.closed')}</p>
          <p className="mt-2 font-mono text-2xl font-medium tabular-nums">{(summary?.orders_approved ?? 0) + (summary?.orders_paid ?? 0)}</p>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Tier auto */}
        <div className="rounded-2xl border border-[#10b981]/30 bg-[#10b981]/5 p-6">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#10b981]">{t('portal.supervisor.team.tier.auto_label')}</p>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="font-headline text-xl">{currentCommission?.tier_label ?? t('portal.supervisor.team.tier.default_label')}</p>
              <p className="mt-1 text-[11px] text-[#e7eaf0]/50">
                {t('portal.supervisor.team.tier.closed_prefix')} <span className="font-mono tabular-nums text-[#e7eaf0]/80">{currentCommission?.units_ytd ?? 0}</span> {t('portal.supervisor.team.tier.closed_suffix')}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-3xl font-bold tabular-nums text-[#10b981]">{Number(currentCommission?.tier_percent ?? 15)}%</p>
              <p className="text-[10px] text-[#e7eaf0]/40">{t('portal.supervisor.team.tier.of_sale_price')}</p>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-[#e7eaf0]/40">{t('portal.supervisor.team.tier.thresholds')}</p>
        </div>

        {/* Fixed override */}
        <div className="rounded-2xl border border-[#ff5625]/30 bg-[#ff5625]/5 p-6">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.supervisor.team.fixed.label')}</p>
            {currentCommission?.source === 'fixed' && (
              <span className="rounded-full bg-[#ff5625]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#ff5625]">{t('portal.supervisor.team.fixed.active_badge')}</span>
            )}
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-[11px] text-[#e7eaf0]/50">{t('portal.supervisor.team.fixed.amount_per_unit')}</span>
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
              {savingPlan ? '...' : t('portal.supervisor.team.fixed.save_btn')}
            </button>
          </div>
          {currentCommission?.source === 'fixed' && (
            <button
              onClick={clearFixed}
              disabled={savingPlan}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#1f2937]/50 px-3 py-2 text-[11px] text-[#e7eaf0]/70 hover:border-[#10b981]/40 hover:text-[#10b981] disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[14px]">backspace</span>
              {t('portal.supervisor.team.fixed.clear_btn')}
            </button>
          )}
        </div>
      </div>
      <div className="mt-8 overflow-hidden rounded-2xl border border-[#1f2937]/40 bg-[#11151a]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#1f2937]/40 bg-[#1a1f26]/40 text-[10px] uppercase tracking-wider text-[#e7eaf0]/60">
            <tr><th className="px-4 py-3">{t('portal.supervisor.team.table.serial')}</th><th className="px-4 py-3">{t('portal.supervisor.team.table.customer')}</th><th className="px-4 py-3 text-right">{t('portal.supervisor.team.table.price')}</th><th className="px-4 py-3">{t('portal.supervisor.team.table.status')}</th></tr>
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
