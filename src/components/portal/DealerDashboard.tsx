'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Profile, Order, DealerSummary, PayoutRow } from '@/lib/portal-types';
import { getDealerSummary, getDealerOrders, getMyPayouts } from '@/lib/portal-queries';

const fmtShortVnd = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0', '') + ' tỷ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'tr';
  return new Intl.NumberFormat('vi-VN').format(n);
};

const tiers = [
  { id: 1, label: 'Tier 1', minUnits: 0, percent: 15 },
  { id: 2, label: 'Tier 2', minUnits: 100, percent: 20 },
  { id: 3, label: 'Tier 3', minUnits: 200, percent: 25 },
  { id: 4, label: 'Tier 4', minUnits: 300, percent: 25 },
];

export function DealerDashboard({ profile }: { profile: Profile }) {
  const [summary, setSummary] = useState<DealerSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);

  useEffect(() => {
    getDealerSummary(profile.id).then(setSummary);
    getDealerOrders(profile.id).then(setOrders);
    getMyPayouts().then(setPayouts);
  }, [profile.id]);

  const unitsYtd = summary?.units_ytd ?? 0;
  const monthSales = summary?.month_sales ?? 0;
  const commissionPending = summary?.commission_pending ?? 0;
  const ordersPending = summary?.orders_pending ?? 0;
  const ordersDone = (summary?.orders_approved ?? 0) + (summary?.orders_paid ?? 0);

  const currentTier = tiers.slice().reverse().find((t) => unitsYtd >= t.minUnits)!;
  const nextTier = tiers.find((t) => t.minUnits > unitsYtd) ?? currentTier;
  const unitsToNext = Math.max(0, nextTier.minUnits - unitsYtd);
  const ladderMax = 300;
  const firstName = profile.full_name?.split(' ').slice(-1)[0] ?? 'Đại lý';

  return (
    <div className="space-y-12 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Số 05 / 2026 · Báo cáo tháng</p>
          <h1 className="mt-2 font-headline text-4xl leading-none tracking-tight md:text-5xl">
            Chào <span className="text-gradient">{firstName}</span>.
          </h1>
        </div>
        <Link href="/portal/dealer/orders/new" className="rounded-full bg-[#ff5625] px-6 py-2.5 text-sm font-medium text-white transition-colors glow-primary-hover hover:bg-[#ff8a5c]">
          + Ghi nhận đơn mới
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-10">
        <div className="md:col-span-7">
          <p className="text-xs uppercase tracking-[0.25em] text-[#e2e2e5]/50">Doanh số tháng này</p>
          <p className="mt-3 font-headline text-[72px] leading-[0.85] tracking-tighter md:text-[140px]">
            {fmtShortVnd(monthSales).replace(/[^0-9]/g, '') || '0'}
            <span className="ml-2 align-top font-mono text-3xl tabular-nums text-[#ff5625]">
              {monthSales >= 1_000_000 ? 'tr ₫' : '₫'}
            </span>
          </p>
          <p className="mt-4 text-sm text-[#e2e2e5]/60">
            <span className="font-mono tabular-nums">{ordersDone}</span> máy đã chốt tháng này
          </p>
        </div>

        <div className="space-y-4 md:col-span-5">
          <div className="overflow-hidden rounded-2xl border border-[#ff5625]/25 bg-gradient-to-br from-[#ff5625]/15 to-[#1e2022] p-6">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff5625]">Kỳ chi trả kế tiếp</p>
            <p className="mt-3 font-headline text-5xl leading-none">
              05<span className="text-[#ff5625]">–</span>10<span className="ml-2 text-xl text-[#e2e2e5]/60">/06</span>
            </p>
            <p className="mt-3 text-sm text-[#e2e2e5]/80">Tự động chi 5–10 hàng tháng cho mọi đơn approved</p>
            <p className="mt-2 text-[11px] text-[#e2e2e5]/50">
              Đợt này: <span className="font-mono tabular-nums">{fmtShortVnd(commissionPending)}</span> VND dự kiến
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-[#1e2022] p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#e2e2e5]/50">Đơn chờ duyệt</p>
              <p className="mt-2 font-mono text-3xl font-medium tabular-nums">{ordersPending}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#1e2022] p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#e2e2e5]/50">Đã chốt</p>
              <p className="mt-2 font-mono text-3xl font-medium tabular-nums">{ordersDone}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-[#1e2022] p-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Bậc hoa hồng năm 2026</p>
            <h2 className="mt-1 font-headline text-2xl">
              {currentTier.label} · {currentTier.percent}%
            </h2>
          </div>
          <p className="text-xs text-[#e2e2e5]/60">
            YTD: <span className="font-mono tabular-nums">{unitsYtd}</span> máy
          </p>
        </div>
        <div className="mt-10">
          <div className="relative h-1 rounded-full bg-white/10">
            <div
              className="absolute left-0 top-0 h-1 rounded-full bg-gradient-to-r from-[#ff5625] to-[#ff8a5c]"
              style={{ width: `${(unitsYtd / ladderMax) * 100}%` }}
            />
            {tiers.slice(0, 4).map((t) => (
              <div
                key={t.id}
                className="absolute -translate-x-1/2"
                style={{ left: `${Math.min((t.minUnits / ladderMax) * 100, 100)}%`, top: '-6px' }}
              >
                <div
                  className={`h-4 w-4 rounded-full border-2 ${
                    unitsYtd >= t.minUnits ? 'border-[#ff5625] bg-[#ff5625]' : 'border-white/30 bg-[#121416]'
                  }`}
                />
              </div>
            ))}
          </div>
          <div className="mt-12 grid grid-cols-4 text-sm">
            {tiers.slice(0, 4).map((t) => (
              <div key={t.id} className={t.id === currentTier.id ? 'opacity-100' : 'opacity-50'}>
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#e2e2e5]/50">{t.label}</p>
                <p className="mt-1 font-mono text-lg font-medium tabular-nums">{t.minUnits}+ máy</p>
                <p className={`font-headline text-2xl ${unitsYtd >= t.minUnits ? 'text-[#ff5625]' : 'text-[#e2e2e5]'}`}>
                  {t.percent}%
                </p>
              </div>
            ))}
          </div>
          {unitsToNext > 0 && (
            <div className="mt-8 flex items-center gap-3 rounded-xl bg-[#ff5625]/10 px-4 py-3 text-sm">
              <span className="font-semibold text-[#ff5625]">▲</span>
              <span>
                Còn <span className="font-mono font-semibold tabular-nums">{unitsToNext}</span> máy nữa lên{' '}
                <span className="font-semibold">{nextTier.label} · {nextTier.percent}%</span>
              </span>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between border-b border-white/10 pb-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff5625]">Hoạt động</p>
            <h2 className="mt-1 font-headline text-3xl">Đơn gần đây</h2>
          </div>
        </div>
        {orders.length === 0 ? (
          <div className="mt-6 rounded-xl border-2 border-dashed border-white/15 p-12 text-center text-sm text-[#e2e2e5]/60">
            <p>Chưa có đơn nào ghi nhận.</p>
          </div>
        ) : (
          <div className="mt-6 divide-y divide-white/10">
            {orders.slice(0, 10).map((o, i) => (
              <div key={o.id} className="flex flex-wrap items-center gap-2 py-3 text-sm md:grid md:grid-cols-12 md:gap-4">
                <span className="font-mono tabular-nums text-[#e2e2e5]/30 md:col-span-1">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-medium md:col-span-4">{o.customer_name}</span>
                <span className="font-mono tabular-nums text-[#e2e2e5]/60 md:col-span-3">{o.serial_number}</span>
                <span className="text-right font-mono tabular-nums md:col-span-2">{fmtShortVnd(o.sale_price)}</span>
                <span className="text-right text-xs uppercase tracking-wider text-[#ff5625] md:col-span-2">{o.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payout history */}
      {payouts.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between border-b border-white/10 pb-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#34d399]">Lịch sử</p>
              <h2 className="mt-1 font-headline text-3xl">Hoa hồng</h2>
            </div>
          </div>
          <div className="mt-6 divide-y divide-white/10">
            {payouts.slice(0, 12).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${p.paid_at ? 'bg-[#34d399]' : 'bg-[#ff5625]'}`} />
                  <span className="font-mono tabular-nums text-xs text-[#e2e2e5]/60">
                    {new Date(p.calculated_at).toLocaleDateString('vi-VN')}
                  </span>
                  {p.payment_proof_url && (
                    <span className="text-[10px] text-[#e2e2e5]/40">Ref: {p.payment_proof_url}</span>
                  )}
                </div>
                <div className="text-right">
                  <p className={`font-mono font-semibold tabular-nums ${p.paid_at ? 'text-[#34d399]' : 'text-[#ff5625]'}`}>
                    {new Intl.NumberFormat('vi-VN').format(Number(p.amount))} đ
                  </p>
                  <p className="text-[10px] text-[#e2e2e5]/40">{p.paid_at ? 'Đã nhận' : 'Chờ chi trả'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
