'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Profile, Order, DealerSummary, PayoutRow } from '@/lib/portal-types';
import { getDealerSummary, getDealerOrders, getMyPayouts } from '@/lib/portal-queries';
import { SparklineBar } from './SparklineBar';
import { RadialTierDonut } from './RadialTierDonut';
import { PortalSkeleton } from './PortalSkeleton';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

const tiers = [
  { id: 1, label: 'Tier 1', minUnits: 0, percent: 15 },
  { id: 2, label: 'Tier 2', minUnits: 101, percent: 20 },
  { id: 3, label: 'Tier 3', minUnits: 201, percent: 25 },
];

const STATUS_META: Record<Order['status'], { label: string; dot: string; pill: string }> = {
  approved: { label: 'Đã duyệt', dot: 'bg-[#10b981]', pill: 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20' },
  paid: { label: 'Đã thanh toán', dot: 'bg-[#10b981]', pill: 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20' },
  pending: { label: 'Chờ duyệt', dot: 'bg-[#f59e0b]', pill: 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20' },
  rejected: { label: 'Từ chối', dot: 'bg-[#f87171]', pill: 'text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20' },
  voided: { label: 'Đã hủy', dot: 'bg-[#9ca3af]', pill: 'text-[#9ca3af] bg-[#9ca3af]/10 border-[#9ca3af]/20' },
};

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

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function DealerDashboard({ profile }: { profile: Profile }) {
  const [summary, setSummary] = useState<DealerSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getDealerSummary(profile.id),
      getDealerOrders(profile.id),
      getMyPayouts(),
    ]).then(([s, o, p]) => {
      if (cancelled) return;
      setSummary(s);
      setOrders(o);
      setPayouts(p);
      setLoading(false);
    });
    return () => { cancelled = true; };
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
  const firstName = profile.full_name ?? 'Đại lý';
  const monthLabel = new Date().toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });

  return (
    <div className="space-y-10 py-4">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Báo cáo tháng {monthLabel}</p>
        <h1 className="mt-2 font-headline text-3xl leading-tight tracking-tight md:text-4xl">
          Chào <span className="text-gradient">{firstName}</span>.
        </h1>
      </header>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-10">
        <div className="md:col-span-7">
          <p className="text-xs uppercase tracking-[0.25em] text-[#9ca3af]">Doanh số tháng này</p>
          <p className="mt-3 font-headline text-[48px] font-medium leading-[0.95] tracking-tight tabular-nums md:text-[72px]">
            {fmtVnd(monthSales)}
            <span className="ml-2 align-top font-mono text-2xl tabular-nums text-[#ff5625]">₫</span>
          </p>
          <div className="mt-4 -mx-1">
            <SparklineBar data={sparkline} width={320} height={36} />
          </div>
          <p className="mt-3 text-sm text-[#9ca3af]">
            <span className="font-mono font-semibold tabular-nums text-[#e7eaf0]">{ordersDone}</span> máy đã chốt tháng này
            {ordersPending > 0 && (
              <>
                {' · '}
                <span className="font-mono tabular-nums text-[#f59e0b]">{ordersPending}</span> chờ duyệt
              </>
            )}
          </p>
        </div>

        <div className="space-y-4 md:col-span-5">
          <div className="overflow-hidden rounded-2xl border border-[#ff5625]/25 bg-gradient-to-br from-[#ff5625]/15 to-[#11151a] p-6">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff5625]">Kỳ chi trả kế tiếp</p>
            <p className="mt-3 font-headline text-4xl leading-none">
              05<span className="text-[#ff5625]">–</span>10<span className="ml-2 text-xl text-[#9ca3af]">/ tháng sau</span>
            </p>
            <p className="mt-3 text-sm text-[#e7eaf0]/80">Tự động chi cho mọi đơn đã duyệt</p>
            <p className="mt-2 text-[11px] text-[#9ca3af]">
              Đợt này: <span className="font-mono font-semibold tabular-nums text-[#ff5625]">{fmtVnd(commissionPending)}</span> ₫
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#1f2937] bg-[#11151a] p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#9ca3af]">Chờ duyệt</p>
              <p className="mt-2 font-mono text-3xl font-medium tabular-nums">{ordersPending}</p>
            </div>
            <div className="rounded-xl border border-[#1f2937] bg-[#11151a] p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#9ca3af]">Đã chốt</p>
              <p className="mt-2 font-mono text-3xl font-medium tabular-nums text-[#10b981]">{ordersDone}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#1f2937] bg-[#11151a] p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Bậc hoa hồng 2026</p>
            <h2 className="mt-1 font-headline text-2xl text-[#e7eaf0]">
              {currentTier.label} · <span className="text-[#ff5625]">{currentTier.percent}%</span>
            </h2>
          </div>
        </div>

        <div className="mt-6 flex justify-center sm:justify-start">
          <RadialTierDonut
            tierLabel={currentTier.label}
            unitsYtd={unitsYtd}
            unitsToNext={unitsToNext}
            nextTierLabel={nextTier.id === currentTier.id ? undefined : `${nextTier.label} · ${nextTier.percent}%`}
            progressPct={progressPct}
          />
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
          {tiers.map((t) => {
            const reached = unitsYtd >= t.minUnits;
            const isCurrent = t.id === currentTier.id;
            return (
              <div
                key={t.id}
                className={`rounded-xl border p-3 transition-colors ${
                  isCurrent
                    ? 'border-[#ff5625]/50 bg-[#ff5625]/[0.06]'
                    : reached
                      ? 'border-[#1f2937] bg-[#0a0c0f]'
                      : 'border-[#1f2937]/60 bg-transparent opacity-60'
                }`}
              >
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#9ca3af]">{t.label}</p>
                <p className="mt-1 font-mono text-sm font-medium tabular-nums text-[#e7eaf0]">{t.minUnits}+ máy</p>
                <p className={`font-headline text-xl ${reached ? 'text-[#ff5625]' : 'text-[#9ca3af]'}`}>
                  {t.percent}%
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between border-b border-[#1f2937] pb-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff5625]">Hoạt động</p>
            <h2 className="mt-1 font-headline text-2xl md:text-3xl">Đơn gần đây</h2>
          </div>
          {orders.length > 0 && (
            <Link href="/portal/dealer/commission" className="text-xs text-[#9ca3af] hover:text-[#ff5625]">
              Xem tất cả →
            </Link>
          )}
        </div>

        {orders.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-[#ff5625]/30 bg-gradient-to-br from-[#ff5625]/[0.08] to-transparent p-8">
            <div className="flex flex-col items-center text-center">
              <span className="material-symbols-outlined text-[40px] text-[#ff5625]">rocket_launch</span>
              <h3 className="mt-3 font-headline text-2xl">Bắt đầu bán hàng</h3>
              <p className="mt-1 text-sm text-[#9ca3af]">Hoàn thành 4 bước để chốt đơn đầu tiên.</p>
            </div>
            <ol className="mt-6 space-y-3">
              {[
                { num: 1, label: 'Hoàn tất hồ sơ tài khoản', desc: 'Thêm tên doanh nghiệp, số điện thoại, ngân hàng nhận hoa hồng.', href: '/portal/profile', icon: 'badge' },
                { num: 2, label: 'Tải QR mời khách', desc: 'In QR ra dán tại điểm bán hoặc gửi qua Zalo/Facebook.', href: '/portal/dealer/qr', icon: 'qr_code_2' },
                { num: 3, label: 'Ghi nhận đơn đầu tiên', desc: 'Nhập thông tin khách + sản phẩm để admin duyệt và tính hoa hồng.', href: '/portal/dealer/orders/new', icon: 'add_circle' },
                { num: 4, label: 'Theo dõi hoa hồng', desc: 'Sau khi admin duyệt đơn, hoa hồng được tính tự động.', href: '/portal/dealer/commission', icon: 'payments' },
              ].map((step) => (
                <li key={step.num}>
                  <Link
                    href={step.href}
                    className="group flex items-center gap-4 rounded-xl border border-[#1f2937] bg-[#11151a] px-4 py-3 transition-all hover:border-[#ff5625]/40 hover:bg-[#ff5625]/[0.04]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ff5625]/40 bg-[#ff5625]/10 font-mono text-sm font-bold tabular-nums text-[#ff5625]">
                      {step.num}
                    </span>
                    <span className="material-symbols-outlined hidden text-[22px] text-[#9ca3af] sm:inline group-hover:text-[#ff5625]">{step.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{step.label}</span>
                      <span className="block text-[11px] text-[#9ca3af]">{step.desc}</span>
                    </span>
                    <span className="material-symbols-outlined shrink-0 text-[20px] text-[#9ca3af] group-hover:text-[#ff5625]">arrow_forward</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <ol className="mt-5 relative ml-3 border-l-2 border-[#1f2937]">
            {orders.slice(0, 10).map((o) => {
              const meta = STATUS_META[o.status];
              return (
                <li key={o.id} className="relative pl-5 pr-2 py-3">
                  <span
                    className={`absolute -left-[7px] top-5 h-3 w-3 rounded-full ring-4 ring-[#0a0c0f] ${meta.dot}`}
                    aria-hidden="true"
                  />
                  <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-r-xl px-3 py-2 transition-colors hover:bg-[#1a1f26]">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono tabular-nums text-[#9ca3af]">
                        {formatDateShort(o.sale_date)} {formatTime(o.created_at)}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[#e7eaf0] truncate">{o.customer_name}</p>
                      <p className="mt-0.5 text-xs text-[#9ca3af]">
                        <span className="font-mono tabular-nums text-[#e7eaf0]">{fmtVnd(o.sale_price)} ₫</span>
                        {o.serial_number && (
                          <>
                            {' · '}
                            <span className="font-mono tabular-nums">{o.serial_number}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] ${meta.pill}`}>
                      {meta.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {payouts.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between border-b border-[#1f2937] pb-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#10b981]">Lịch sử</p>
              <h2 className="mt-1 font-headline text-2xl md:text-3xl">Hoa hồng</h2>
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
                    <span className="text-[10px] text-[#9ca3af]">Ref: {p.payment_proof_url}</span>
                  )}
                </div>
                <div className="text-right">
                  <p className={`font-mono font-semibold tabular-nums ${p.paid_at ? 'text-[#10b981]' : 'text-[#ff5625]'}`}>
                    {new Intl.NumberFormat('vi-VN').format(Number(p.amount))} đ
                  </p>
                  <p className="text-[10px] text-[#9ca3af]">{p.paid_at ? 'Đã nhận' : 'Chờ chi trả'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
