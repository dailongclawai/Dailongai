'use client';

import { useMemo, useState } from 'react';
import type { LeaderboardRow } from '@/lib/portal-queries';
import { useI18n } from '@/lib/i18n';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

type SortKey = 'month_sales' | 'month_units' | 'sales_7d';

const LABEL_KEYS: Record<SortKey, string> = {
  month_sales: 'portal.components.podiumLeaderboard.sort_month_sales',
  month_units: 'portal.components.podiumLeaderboard.sort_month_units',
  sales_7d: 'portal.components.podiumLeaderboard.sort_7d',
};

const PODIUM_META = {
  1: { medal: '🥇', height: 'h-28', bar: 'bg-gradient-to-t from-[#f59e0b] to-[#fde68a]', label: 'text-[#f59e0b]' },
  2: { medal: '🥈', height: 'h-20', bar: 'bg-gradient-to-t from-[#9ca3af] to-[#e5e7eb]', label: 'text-[#9ca3af]' },
  3: { medal: '🥉', height: 'h-14', bar: 'bg-gradient-to-t from-[#cd7f32] to-[#f0b97a]', label: 'text-[#cd7f32]' },
} as const;

function shortName(name: string | null, fallback: string): string {
  if (!name) return fallback;
  const trimmed = name.trim();
  if (trimmed.length <= 14) return trimmed;
  return trimmed.slice(0, 12) + '…';
}

function renderValue(r: LeaderboardRow, key: SortKey, unitLabel: string): string {
  if (key === 'month_units') return `${r.month_units} ${unitLabel}`;
  return `${fmtVnd(Number(r[key]))} ₫`;
}

interface Props {
  rows: LeaderboardRow[];
}

export function PodiumLeaderboard({ rows }: Props) {
  const { t } = useI18n();
  const [sortBy, setSortBy] = useState<SortKey>('month_sales');
  const noNameLabel = t('portal.components.podiumLeaderboard.no_name');
  const unitLabel = t('portal.components.podiumLeaderboard.unit_short');

  const ranked = useMemo(
    () => [...rows].sort((a, b) => Number(b[sortBy]) - Number(a[sortBy])).slice(0, 5),
    [rows, sortBy],
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#1f2937] bg-[#11151a] p-6 text-center text-sm text-[#9ca3af]">
        {t('portal.components.podiumLeaderboard.empty')}
      </div>
    );
  }

  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as LeaderboardRow[];
  const rankByDealer = new Map(top3.map((r, i) => [r.dealer_id, (i + 1) as 1 | 2 | 3]));

  return (
    <div className="overflow-hidden rounded-2xl border border-[#1f2937] bg-[#11151a]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2937] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[#f59e0b]">leaderboard</span>
          <p className="text-sm font-semibold">{t('portal.components.podiumLeaderboard.title')}</p>
        </div>
        <div className="inline-flex gap-1 rounded-lg border border-[#1f2937] bg-[#0a0c0f] p-0.5 text-[11px]">
          {(Object.keys(LABEL_KEYS) as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSortBy(k)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                sortBy === k ? 'bg-[#ff5625] text-white' : 'text-[#9ca3af] hover:text-[#e7eaf0]'
              }`}
            >
              {t(LABEL_KEYS[k])}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end justify-center gap-4 px-5 pt-6 pb-3 sm:gap-6">
        {podiumOrder.map((r) => {
          const rank = rankByDealer.get(r.dealer_id)!;
          const meta = PODIUM_META[rank];
          return (
            <div key={r.dealer_id} className="flex w-20 flex-col items-center sm:w-24">
              <span className="text-2xl">{meta.medal}</span>
              <p className="mt-1 max-w-full truncate text-center text-[11px] font-semibold text-[#e7eaf0]">
                {shortName(r.dealer_name, noNameLabel)}
              </p>
              <p className={`mt-0.5 text-center font-mono text-[10px] font-semibold tabular-nums ${meta.label}`}>
                {renderValue(r, sortBy, unitLabel)}
              </p>
              <div
                className={`mt-2 w-full rounded-t-md ${meta.bar} ${meta.height}`}
                aria-hidden="true"
                style={{ transformOrigin: 'bottom', animation: 'podiumGrow 600ms ease-out' }}
              />
              <p className="-mt-px w-full rounded-b-md bg-[#0a0c0f] py-1 text-center font-mono text-[10px] font-bold tabular-nums text-[#9ca3af]">
                #{rank}
              </p>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <ol className="divide-y divide-[#1f2937] border-t border-[#1f2937]">
          {rest.map((r, i) => (
            <li key={r.dealer_id} className="flex items-center gap-3 px-5 py-3">
              <span className="w-8 shrink-0 font-mono text-xs font-bold tabular-nums text-[#9ca3af]">
                #{i + 4}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm text-[#e7eaf0]">{r.dealer_name ?? noNameLabel}</p>
              <p className="shrink-0 font-mono text-xs font-semibold tabular-nums text-[#ff5625]">
                {renderValue(r, sortBy, unitLabel)}
              </p>
            </li>
          ))}
        </ol>
      )}

      <style>{`@keyframes podiumGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }`}</style>
    </div>
  );
}
