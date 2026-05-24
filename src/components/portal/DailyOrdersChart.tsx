'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface Row {
  sale_date: string;
  sale_price: number;
  status: string;
  commission?: { voided_at: string | null } | null;
}

interface Props {
  rows: Row[];
  days?: number;
  title?: string;
  subtitle?: string;
}

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

function isSuccess(r: Row): boolean {
  if (r.commission && !r.commission.voided_at) return true;
  return r.status === 'approved' || r.status === 'paid';
}

export function DailyOrdersChart({ rows, days = 30, title, subtitle }: Props) {
  const { t } = useI18n();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const resolvedTitle = title ?? t('portal.components.dailyOrdersChart.default_title');

  const buckets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const list: { date: Date; key: string; count: number; revenue: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      list.push({ date: d, key: d.toISOString().slice(0, 10), count: 0, revenue: 0 });
    }
    const map = new Map(list.map((b, idx) => [b.key, idx] as const));
    for (const r of rows) {
      if (!isSuccess(r)) continue;
      const idx = map.get(r.sale_date);
      if (idx === undefined) continue;
      list[idx].count += 1;
      list[idx].revenue += Number(r.sale_price) || 0;
    }
    return list;
  }, [rows, days]);

  const stats = useMemo(() => {
    const totalRev = buckets.reduce((s, b) => s + b.revenue, 0);
    const totalCnt = buckets.reduce((s, b) => s + b.count, 0);
    const maxRev = Math.max(1, ...buckets.map((b) => b.revenue));
    const maxCnt = Math.max(1, ...buckets.map((b) => b.count));
    const activeDays = buckets.filter((b) => b.count > 0).length;
    const avgDaily = activeDays > 0 ? totalRev / activeDays : 0;
    const lastDay = buckets[buckets.length - 1];
    return { totalRev, totalCnt, maxRev, maxCnt, activeDays, avgDaily, lastDay };
  }, [buckets]);

  const hovered = hoverIdx !== null ? buckets[hoverIdx] : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1f2937]/40 bg-gradient-to-br from-[#1e2022] via-[#1e2022] to-[#0c0e10] p-6">
      <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-[#ff5625]/[0.06] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[#10b981]/[0.04] blur-3xl" />

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{resolvedTitle}</p>
          <h3 className="mt-1 font-headline text-2xl leading-tight">
            {fmtVnd(stats.totalRev)}<span className="ml-1 text-base text-[#e7eaf0]/50">₫</span>
            <span className="ml-3 font-mono text-base font-normal text-[#10b981]">
              · {stats.totalCnt} {t('portal.components.dailyOrdersChart.orders_short')}
            </span>
          </h3>
          <p className="mt-1 text-[11px] text-[#e7eaf0]/50">
            {subtitle ?? `${days} ${t('portal.components.dailyOrdersChart.default_subtitle_suffix')}`}
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#e7eaf0]/40">{t('portal.components.dailyOrdersChart.avg_per_day')}</p>
            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">{fmtVnd(stats.avgDaily)} ₫</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#e7eaf0]/40">{t('portal.components.dailyOrdersChart.active_days')}</p>
            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
              {stats.activeDays}<span className="text-[#e7eaf0]/40">/{days}</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#e7eaf0]/40">{t('portal.components.dailyOrdersChart.today')}</p>
            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
              {stats.lastDay.count > 0 ? (
                <span className="text-[#10b981]">{stats.lastDay.count} · {fmtVnd(stats.lastDay.revenue)}₫</span>
              ) : (
                <span className="text-[#e7eaf0]/40">—</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="relative mt-6">
        {/* Hover tooltip */}
        <div className="mb-2 h-12">
          {hovered && (
            <div className="inline-flex items-center gap-3 rounded-lg border border-[#ff5625]/30 bg-[#06080a]/80 px-3 py-1.5 text-xs backdrop-blur-sm">
              <span className="text-[#e7eaf0]/60">
                {hovered.date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
              </span>
              <span className="font-mono font-semibold text-[#ff5625] tabular-nums">{fmtVnd(hovered.revenue)} ₫</span>
              <span className="font-mono tabular-nums text-[#10b981]">{hovered.count} {t('portal.components.dailyOrdersChart.orders_short')}</span>
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="relative h-44">
          {/* Grid lines */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border-t border-dashed border-[#1f2937]/30" />
            ))}
          </div>

          {/* Y-axis label */}
          <div className="pointer-events-none absolute -left-1 top-0 font-mono text-[9px] uppercase tracking-wider text-[#e7eaf0]/30">
            {fmtVnd(stats.maxRev)}₫
          </div>

          {/* Bars */}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {buckets.map((b, idx) => {
              const heightPct = b.revenue > 0 ? Math.max(2, (b.revenue / stats.maxRev) * 100) : 0;
              const isHovered = hoverIdx === idx;
              const hasData = b.count > 0;
              return (
                <div
                  key={b.key}
                  className="group relative flex h-full flex-1 cursor-pointer items-end"
                  onMouseEnter={() => setHoverIdx(idx)}
                  onMouseLeave={() => setHoverIdx((curr) => (curr === idx ? null : curr))}
                  onClick={() => setHoverIdx(isHovered ? null : idx)}
                >
                  {hasData ? (
                    <div
                      className={`relative w-full rounded-t-sm transition-all ${
                        isHovered
                          ? 'bg-gradient-to-t from-[#ff5625] to-[#ff8a5b] shadow-[0_0_12px_rgba(255,86,37,0.4)]'
                          : 'bg-gradient-to-t from-[#ff5625]/70 to-[#ff5625]/90 group-hover:from-[#ff5625] group-hover:to-[#ff8a5b]'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    >
                      {b.count > 1 && (
                        <span className="pointer-events-none absolute left-1/2 top-0.5 -translate-x-1/2 font-mono text-[8px] font-bold text-[#0c0e10]">
                          {b.count}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="h-[2px] w-full rounded-full bg-[#3d3f41]/40" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* X-axis labels (every ~5 days) */}
        <div className="mt-2 flex gap-[2px]">
          {buckets.map((b, idx) => {
            const showLabel = idx === 0 || idx === buckets.length - 1 || idx % Math.ceil(buckets.length / 6) === 0;
            return (
              <div key={b.key} className="flex-1 text-center font-mono text-[9px] tabular-nums text-[#e7eaf0]/30">
                {showLabel ? b.date.getDate() + '/' + (b.date.getMonth() + 1) : ''}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
