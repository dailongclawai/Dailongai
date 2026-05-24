'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Profile, Order, DealerSummary, PayoutRow, DealerCurrentCommission } from '@/lib/portal-types';
import { getDealerSummary, getDealerOrders, getMyPayouts, getDealerCurrentCommissions } from '@/lib/portal-queries';
import { getSupabaseClient } from '@/lib/supabase';
import { toast } from 'sonner';
import { SparklineBar } from './SparklineBar';
import { RadialTierDonut } from './RadialTierDonut';
import { PortalSkeleton } from './PortalSkeleton';
import { ActivityFeed } from './ActivityFeed';
import { useI18n } from '@/lib/i18n';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

const tiers = [
  { id: 1, label: 'Tier 1', minUnits: 0, percent: 15 },
  { id: 2, label: 'Tier 2', minUnits: 201, percent: 20 },
  { id: 3, label: 'Tier 3', minUnits: 301, percent: 25 },
];

function buildSparkline(orders: Order[], days = 30): number[] {
  const bucket: number[] = Array.from({ length: days }, () => 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  for (const o of orders) {
    if (o.status === 'rejected' || o.status === 'voided') continue;
    const d = new Date(o.sale_date);
    d.setHours(0, 0, 0, 0);
    if (d < cutoff || d > today) continue;
    const idx = Math.floor((d.getTime() - cutoff.getTime()) / 86_400_000);
    if (idx >= 0 && idx < days) bucket[idx] += o.sale_price;
  }
  return bucket;
}

export function DealerDashboard({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  const [summary, setSummary] = useState<DealerSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [commission, setCommission] = useState<DealerCurrentCommission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getDealerSummary(profile.id),
      getDealerOrders(profile.id),
      getMyPayouts(),
      getDealerCurrentCommissions([profile.id]).catch((): Record<string, DealerCurrentCommission> => ({})),
    ]).then(([s, o, p, c]) => {
      if (cancelled) return;
      setSummary(s);
      setOrders(o);
      setPayouts(p);
      setCommission(c[profile.id] ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [profile.id]);

  // Live sync: refetch commission + summary when supervisor changes plan
  useEffect(() => {
    const supabase = getSupabaseClient();
    let hasBaseline = false;
    let seenSource: 'fixed' | 'tier_auto' | undefined;
    let seenAmount: number | null = null;

    const refetchCommission = async () => {
      const [c, s] = await Promise.all([
        getDealerCurrentCommissions([profile.id]).catch((): Record<string, DealerCurrentCommission> => ({})),
        getDealerSummary(profile.id).catch(() => null),
      ]);
      const next = c[profile.id] ?? null;
      const nextAmt = next?.override_amount == null ? null : Number(next.override_amount);

      // Only toast on REAL transitions — first fetch establishes baseline silently
      if (next && hasBaseline && (next.source !== seenSource || nextAmt !== seenAmount)) {
        const label = next.source === 'fixed'
          ? `${t('portal.components.dealerDashboard.toast_fixed_prefix')} ${new Intl.NumberFormat('vi-VN').format(Number(next.override_amount ?? 0))} ${t('portal.components.dealerDashboard.toast_fixed_suffix')}`
          : `${t('portal.components.dealerDashboard.toast_tier_prefix')} (${next.tier_label})`;
        toast.info(label);
      }
      if (next) {
        seenSource = next.source;
        seenAmount = nextAmt;
        hasBaseline = true;
      }

      setCommission(next);
      if (s) setSummary(s);
    };

    const channel = supabase
      .channel(`dealer-commission-rule-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dealer_commissions', filter: `dealer_id=eq.${profile.id}` },
        () => void refetchCommission(),
      )
      .subscribe();

    const onFocus = () => { void refetchCommission(); };
    window.addEventListener('focus', onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const sparkline = useMemo(() => buildSparkline(orders), [orders]);

  if (loading) return <PortalSkeleton.Dashboard />;

  const unitsYtd = summary?.units_ytd ?? 0;
  const monthSales = summary?.month_sales ?? 0;
  const commissionPending = summary?.commission_pending ?? 0;
  const ordersPending = summary?.orders_pending ?? 0;
  const ordersDone = (summary?.orders_approved ?? 0) + (summary?.orders_paid ?? 0);

  const currentTier = tiers.slice().reverse().find((t) => unitsYtd >= t.minUnits)!;
  const nextTier = tiers.find((t) => t.minUnits > unitsYtd) ?? currentTier;
  const unitsToNext = Math.max(0, nextTier.minUnits - unitsYtd);
  const progressPct = nextTier.id === currentTier.id
    ? 100
    : Math.min(100, ((unitsYtd - currentTier.minUnits) / Math.max(1, nextTier.minUnits - currentTier.minUnits)) * 100);
  const firstName = profile.full_name ?? t('portal.components.dealerDashboard.dealer_fallback_name');
  // Build label manually: vi-VN locale prepends "tháng" → would double up with our "tháng" label
  const now = new Date();
  const monthLabel = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysToReset = lastDayOfMonth - now.getDate() + 1;

  return (
    <div className="space-y-8 py-4">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.components.dealerDashboard.monthly_report')} {monthLabel}</p>
        <h1 className="mt-2 font-headline text-3xl leading-tight tracking-tight md:text-4xl">
          {t('portal.components.dealerDashboard.greeting')} <span className="text-gradient">{firstName}</span>.
        </h1>
      </header>

      {/* HERO: Hoa hồng đang chờ chi — biggest visual weight */}
      <section className="relative overflow-hidden rounded-3xl border border-[#10b981]/30 bg-gradient-to-br from-[#10b981]/[0.10] via-[#10b981]/[0.04] to-[#11151a] p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#10b981]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-12 h-48 w-48 rounded-full bg-[#10b981]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-[#10b981]">account_balance_wallet</span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#10b981]">
                {t('portal.components.dealerDashboard.commission_pending')}
              </p>
            </div>
            <p className="mt-3 font-headline text-[44px] font-bold leading-none tracking-tight tabular-nums text-[#10b981] md:text-[64px]">
              {fmtVnd(commissionPending)}
              <span className="ml-2 align-top font-mono text-2xl tabular-nums text-[#10b981]/70">₫</span>
            </p>
            <p className="mt-3 text-xs text-[#9ca3af]">
              {t('portal.components.dealerDashboard.auto_payout_note')} <span className="font-mono font-semibold tabular-nums text-[#e7eaf0]">{fmtVnd(summary?.commission_paid ?? 0)} ₫</span>
            </p>
          </div>
        </div>
      </section>

      {/* Quick actions — 4 pills, mobile 2-col / desktop 4-col */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Link
          href="/portal/dealer/orders/new"
          className="group flex items-center justify-center gap-2 rounded-xl bg-[#ff5625] px-3 py-3 text-xs font-bold text-white shadow-[0_4px_14px_-4px_rgba(255,86,37,0.6)] transition-colors hover:bg-[#ff6a3d] active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          {t('portal.shell.cta.new_order')}
        </Link>
        <Link
          href="/portal/dealer/qr"
          className="flex items-center justify-center gap-2 rounded-xl border border-[#1f2937] bg-[#11151a] px-3 py-3 text-xs font-semibold text-[#e7eaf0] transition-colors hover:border-[#ff5625] hover:text-[#ff5625]"
        >
          <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
          {t('portal.components.dealerDashboard.action_qr_order')}
        </Link>
        <Link
          href="/portal/dealer/commission"
          className="flex items-center justify-center gap-2 rounded-xl border border-[#1f2937] bg-[#11151a] px-3 py-3 text-xs font-semibold text-[#e7eaf0] transition-colors hover:border-[#ff5625] hover:text-[#ff5625]"
        >
          <span className="material-symbols-outlined text-[18px]">payments</span>
          {t('portal.components.dealerDashboard.commission_book')}
        </Link>
        <Link
          href="/portal/payout-info"
          className="flex items-center justify-center gap-2 rounded-xl border border-[#1f2937] bg-[#11151a] px-3 py-3 text-xs font-semibold text-[#e7eaf0] transition-colors hover:border-[#ff5625] hover:text-[#ff5625]"
        >
          <span className="material-symbols-outlined text-[18px]">account_balance</span>
          {t('portal.components.dealerDashboard.action_account')}
        </Link>
      </section>

      {/* Doanh số — secondary, smaller than hero commission. Single row metric replaces duplicate tiles. */}
      <section className="rounded-3xl border border-[#1f2937] bg-[#11151a] p-6 md:p-8">
        <p className="text-xs uppercase tracking-[0.25em] text-[#9ca3af]">{t('portal.components.dealerDashboard.month_sales')}</p>
        <p className="mt-2 font-headline text-[36px] font-medium leading-[0.95] tracking-tight tabular-nums md:text-[44px]">
          {fmtVnd(monthSales)}
          <span className="ml-2 align-top font-mono text-xl tabular-nums text-[#ff5625]">₫</span>
        </p>
        <div className="mt-3 -mx-1">
          <SparklineBar data={sparkline} width={320} height={32} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#1f2937] pt-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#10b981]" />
            <span className="text-[#9ca3af]">{t('portal.components.dealerDashboard.status_closed')}</span>
            <span className="font-mono font-bold tabular-nums text-[#10b981]">{ordersDone}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
            <span className="text-[#9ca3af]">{t('portal.components.dealerDashboard.status_pending')}</span>
            <span className="font-mono font-bold tabular-nums text-[#f59e0b]">{ordersPending}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />
            <span className="text-[#9ca3af]">{t('portal.components.dealerDashboard.status_paid')}</span>
            <span className="font-mono font-bold tabular-nums text-[#3b82f6]">{summary?.orders_paid ?? 0}</span>
          </span>
        </div>
      </section>

      {commission?.source === 'fixed' ? (
        <section className="rounded-3xl border border-[#ff5625]/40 bg-gradient-to-br from-[#ff5625]/[0.08] to-[#11151a] p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-[#ff5625]">workspace_premium</span>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.components.dealerDashboard.custom_plan_label')}</p>
            </div>
            <span className="rounded-full bg-[#ff5625]/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#ff5625]">
              {t('portal.components.dealerDashboard.custom_plan_badge')}
            </span>
          </div>

          <div className="mt-6 flex flex-col items-center text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
            <div>
              <p className="text-xs uppercase tracking-wider text-[#9ca3af]">{t('portal.components.dealerDashboard.commission_per_unit')}</p>
              <p className="mt-1 font-headline text-[44px] font-bold leading-none tabular-nums text-[#ff5625] md:text-[56px]">
                {fmtVnd(Number(commission.override_amount ?? 0))}
                <span className="ml-2 align-top font-mono text-2xl tabular-nums text-[#ff5625]/70">₫</span>
              </p>
              <p className="mt-2 text-xs text-[#9ca3af]">
                {t('portal.components.dealerDashboard.fixed_plan_note')}
              </p>
            </div>
            <div className="mt-4 rounded-xl border border-[#1f2937] bg-[#0a0c0f] px-4 py-3 sm:mt-0">
              <p className="text-[10px] uppercase tracking-wider text-[#9ca3af]">{t('portal.components.dealerDashboard.units_ytd')}</p>
              <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums text-[#e7eaf0]">
                {commission.units_ytd ?? unitsYtd}
                <span className="ml-1 text-xs text-[#9ca3af]">{t('portal.components.dealerDashboard.unit_short')}</span>
              </p>
            </div>
          </div>

          <p className="mt-6 flex items-start gap-1.5 rounded-xl border border-[#1f2937] bg-[#0a0c0f]/60 p-3 text-[11px] text-[#9ca3af]">
            <span className="material-symbols-outlined text-[14px] text-[#9ca3af]">info</span>
            {t('portal.components.dealerDashboard.supervisor_fixed_note')}
          </p>
        </section>
      ) : (
        <section className="relative overflow-hidden rounded-3xl border border-[#ff5625]/20 bg-gradient-to-br from-[#ff5625]/[0.04] via-[#11151a] to-[#11151a] p-6 md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#ff5625]/10 blur-3xl" />

          {/* Header row */}
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.components.dealerDashboard.tier_month_label')} {monthLabel}</p>
              <h2 className="mt-1 flex items-baseline gap-2 font-headline text-2xl text-[#e7eaf0] md:text-3xl">
                {currentTier.label}
                <span className="rounded-md bg-[#ff5625]/15 px-2 py-0.5 font-mono text-base tabular-nums text-[#ff5625]">{currentTier.percent}%</span>
              </h2>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#1f2937] bg-[#0a0c0f]/60 px-3 py-1 text-[10px] uppercase tracking-wider text-[#9ca3af]">
              <span className="material-symbols-outlined text-[14px] text-[#f59e0b]">timer</span>
              {t('portal.components.dealerDashboard.reset_in_prefix')} <span className="font-mono font-bold tabular-nums text-[#e7eaf0]">{daysToReset}</span> {t('portal.components.dealerDashboard.days_suffix')}
            </div>
          </div>

          {/* Main: donut + next-tier prompt */}
          <div className="relative mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="shrink-0">
              <RadialTierDonut
                tierLabel={currentTier.label}
                unitsYtd={unitsYtd}
                unitsToNext={unitsToNext}
                nextTierLabel={nextTier.id === currentTier.id ? undefined : `${nextTier.label} · ${nextTier.percent}%`}
                progressPct={progressPct}
              />
            </div>
            <div className="min-w-0 flex-1 self-center text-center sm:text-left">
              {nextTier.id !== currentTier.id ? (
                <>
                  <p className="text-[11px] uppercase tracking-wider text-[#9ca3af]">{t('portal.components.dealerDashboard.units_to_next_label')}</p>
                  <p className="mt-1 font-headline text-4xl font-bold tabular-nums text-[#e7eaf0] md:text-5xl">
                    {unitsToNext}<span className="ml-1 text-xl text-[#9ca3af]">{t('portal.components.dealerDashboard.unit_short')}</span>
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#10b981]/10 px-3 py-1 text-xs text-[#10b981]">
                    <span aria-hidden="true">▲</span>
                    {t('portal.components.dealerDashboard.unlock_label')} <span className="font-bold">{nextTier.label} · {nextTier.percent}%</span>
                    {' '}(+{nextTier.percent - currentTier.percent}%)
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[11px] uppercase tracking-wider text-[#10b981]">{t('portal.components.dealerDashboard.top_tier_label')}</p>
                  <p className="mt-1 font-headline text-3xl font-bold text-[#10b981] md:text-4xl">
                    {t('portal.components.dealerDashboard.top_tier_value')}
                  </p>
                  <p className="mt-2 text-xs text-[#9ca3af]">{t('portal.components.dealerDashboard.top_tier_note')}</p>
                </>
              )}
            </div>
          </div>

          {/* Stair ladder — 3 segments showing progression */}
          <div className="relative mt-7 grid grid-cols-3 gap-1">
            {tiers.map((tier, i) => {
              const next = tiers[i + 1];
              const range = next ? `${Math.max(1, tier.minUnits)}–${next.minUnits - 1}` : `${tier.minUnits}+`;
              const isCurrent = tier.id === currentTier.id;
              const reached = unitsYtd >= tier.minUnits;
              const heightClass = i === 0 ? 'h-14' : i === 1 ? 'h-20' : 'h-28';
              return (
                <div key={tier.id} className="flex flex-col-reverse items-center">
                  <p className={`mt-1 text-center font-mono text-[10px] tabular-nums ${isCurrent ? 'font-bold text-[#ff5625]' : 'text-[#9ca3af]'}`}>
                    {range} {t('portal.components.dealerDashboard.unit_short')}
                  </p>
                  <div
                    className={`relative flex w-full items-center justify-center rounded-t-lg transition-colors ${heightClass} ${
                      isCurrent
                        ? 'bg-gradient-to-t from-[#ff5625] to-[#f59e0b] shadow-[0_0_24px_-4px_rgba(255,86,37,0.6)]'
                        : reached
                          ? 'bg-[#ff5625]/30'
                          : 'bg-[#1f2937]/60'
                    }`}
                  >
                    <span className={`font-headline text-xl font-bold ${isCurrent ? 'text-white' : reached ? 'text-[#ff5625]' : 'text-[#9ca3af]'}`}>
                      {tier.percent}%
                    </span>
                    {isCurrent && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#ff5625] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-white">
                        ★
                      </span>
                    )}
                  </div>
                  <p className={`text-center text-[10px] uppercase tracking-wider ${isCurrent ? 'font-bold text-[#e7eaf0]' : 'text-[#9ca3af]'}`}>
                    {tier.label.replace('Tier ', 'T')}
                  </p>
                </div>
              );
            })}
          </div>

        </section>
      )}

      {orders.length > 0 && <ActivityFeed orders={orders} />}

      {payouts.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between border-b border-[#1f2937] pb-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#10b981]">{t('portal.components.dealerDashboard.history_label')}</p>
              <h2 className="mt-1 font-headline text-2xl md:text-3xl">{t('portal.components.dealerDashboard.commission_label')}</h2>
            </div>
          </div>
          <div className="mt-6 divide-y divide-[#1f2937]">
            {payouts.slice(0, 12).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${p.paid_at ? 'bg-[#10b981]' : 'bg-[#ff5625]'}`} />
                  <span className="font-mono tabular-nums text-xs text-[#9ca3af]">
                    {new Date(p.calculated_at).toLocaleDateString('vi-VN')}
                  </span>
                  {p.payment_proof_url && (
                    <span className="text-[10px] text-[#9ca3af]">{t('portal.components.dealerDashboard.ref_label')}: {p.payment_proof_url}</span>
                  )}
                </div>
                <div className="text-right">
                  <p className={`font-mono font-semibold tabular-nums ${p.paid_at ? 'text-[#10b981]' : 'text-[#ff5625]'}`}>
                    {new Intl.NumberFormat('vi-VN').format(Number(p.amount))} đ
                  </p>
                  <p className="text-[10px] text-[#9ca3af]">{p.paid_at ? t('portal.components.dealerDashboard.payout_received') : t('portal.components.dealerDashboard.payout_waiting')}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
