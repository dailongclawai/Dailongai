'use client';

import { useMemo } from 'react';
import type { PayoutRow } from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return `${m}/${y}`;
};

interface MonthBucket {
  key: string;
  label: string;
  paid: number;
  pending: number;
  total: number;
  count: number;
}

export function SupervisorIncomeSummary({ payouts }: { payouts: PayoutRow[] }) {
  const months = useMemo(() => {
    const map = new Map<string, MonthBucket>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, { key, label: monthLabel(key), paid: 0, pending: 0, total: 0, count: 0 });
    }
    for (const p of payouts) {
      const d = new Date(p.paid_at ?? p.calculated_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = map.get(key);
      if (!bucket) continue;
      const amount = Number(p.amount) || 0;
      bucket.total += amount;
      bucket.count += 1;
      if (p.paid_at) bucket.paid += amount;
      else bucket.pending += amount;
    }
    return Array.from(map.values());
  }, [payouts]);

  const totals = useMemo(() => {
    const paid = months.reduce((s, m) => s + m.paid, 0);
    const pending = months.reduce((s, m) => s + m.pending, 0);
    const ytd = months.reduce((s, m) => s + m.total, 0);
    const maxMonth = Math.max(1, ...months.map((m) => m.total));
    return { paid, pending, ytd, maxMonth };
  }, [months]);

  const currentMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const growthPct = prevMonth && prevMonth.total > 0
    ? Math.round(((currentMonth.total - prevMonth.total) / prevMonth.total) * 100)
    : null;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#10b981]/30 bg-gradient-to-br from-[#10b981]/[0.08] via-[#1e2022] to-[#0c0e10] p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-[#10b981]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[#ff5625]/[0.04] blur-3xl" />

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#10b981]">Thu nhập của tôi</p>
          <h2 className="mt-1 font-headline text-2xl leading-tight sm:text-3xl">
            Tháng <span className="text-[#10b981]">{currentMonth.label}</span>
          </h2>
          <p className="mt-2 flex items-baseline gap-3 font-headline">
            <span className="text-4xl font-semibold tabular-nums sm:text-5xl">{fmtVnd(currentMonth.total)}</span>
            <span className="text-base text-[#e7eaf0]/50">₫</span>
            {growthPct !== null && (
              <span
                className={`ml-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums ${
                  growthPct >= 0
                    ? 'bg-[#10b981]/15 text-[#10b981]'
                    : 'bg-[#ff5625]/15 text-[#ff5625]'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {growthPct >= 0 ? 'trending_up' : 'trending_down'}
                </span>
                {growthPct >= 0 ? '+' : ''}{growthPct}%
              </span>
            )}
          </p>
          <p className="mt-1 text-[11px] text-[#e7eaf0]/50">
            Số liệu do kế toán ghi nhận · so với tháng trước
          </p>
        </div>

        <div className="flex gap-4 text-right sm:gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#e7eaf0]/40">Đã nhận 6 tháng</p>
            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#10b981]">
              {fmtVnd(totals.paid)} ₫
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#e7eaf0]/40">Đang chờ chi</p>
            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#ff5625]">
              {fmtVnd(totals.pending)} ₫
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#e7eaf0]/40">Tổng 6 tháng</p>
            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
              {fmtVnd(totals.ytd)} ₫
            </p>
          </div>
        </div>
      </div>

      {/* Monthly bars */}
      <div className="relative mt-8 grid grid-cols-6 gap-2 sm:gap-3">
        {months.map((m) => {
          const heightPct = totals.maxMonth > 0 ? (m.total / totals.maxMonth) * 100 : 0;
          const paidPct = m.total > 0 ? (m.paid / m.total) * 100 : 0;
          const isCurrent = m.key === currentMonth.key;
          return (
            <div key={m.key} className="flex flex-col items-center">
              <div className="relative flex h-32 w-full items-end overflow-hidden rounded-lg border border-[#1f2937]/30 bg-[#06080a]/40">
                {m.total > 0 ? (
                  <div
                    className={`relative w-full overflow-hidden rounded-md transition-all ${
                      isCurrent ? 'shadow-[0_0_16px_rgba(52,211,153,0.3)]' : ''
                    }`}
                    style={{ height: `${Math.max(8, heightPct)}%` }}
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#10b981] to-[#10b981]/70"
                      style={{ height: `${paidPct}%` }}
                    />
                    <div
                      className="absolute inset-x-0 top-0 bg-gradient-to-t from-[#ff5625]/60 to-[#ff5625]/30"
                      style={{ height: `${100 - paidPct}%` }}
                    />
                  </div>
                ) : (
                  <div className="h-[3px] w-full rounded-full bg-[#3d3f41]/40" />
                )}
              </div>
              <p className={`mt-2 font-mono text-[11px] font-semibold tabular-nums ${isCurrent ? 'text-[#e7eaf0]' : 'text-[#e7eaf0]/50'}`}>
                {m.label}
              </p>
              <p className={`font-mono text-[10px] tabular-nums ${m.total > 0 ? (isCurrent ? 'text-[#10b981]' : 'text-[#e7eaf0]/60') : 'text-[#e7eaf0]/25'}`}>
                {m.total > 0 ? fmtVnd(m.total) : '—'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="relative mt-5 flex items-center justify-end gap-4 text-[10px] text-[#e7eaf0]/45">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-gradient-to-t from-[#10b981] to-[#10b981]/70" /> Đã nhận
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-gradient-to-t from-[#ff5625]/60 to-[#ff5625]/30" /> Chờ chi
        </span>
      </div>
    </div>
  );
}
