'use client';

import { useI18n } from '@/lib/i18n';

interface RadialTierDonutProps {
  tierLabel: string;
  unitsYtd: number;
  unitsToNext: number;
  nextTierLabel?: string;
  progressPct: number;
  size?: number;
  strokeWidth?: number;
}

export function RadialTierDonut({
  tierLabel,
  unitsYtd,
  unitsToNext,
  nextTierLabel,
  progressPct,
  size = 144,
  strokeWidth = 14,
}: RadialTierDonutProps) {
  const { t } = useI18n();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, progressPct));
  const dashOffset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <div className="flex flex-col items-center sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <linearGradient id="tier-arc-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff5625" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#1f2937"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="url(#tier-arc-gradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
            style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ff5625]">{tierLabel}</span>
          <span className="font-mono text-2xl font-semibold tabular-nums text-[#e7eaf0]">{unitsYtd}</span>
          <span className="text-[10px] uppercase tracking-wider text-[#9ca3af]">{t('portal.components.radialTierDonut.units_this_month')}</span>
        </div>
      </div>

      <div className="mt-4 text-center sm:mt-0 sm:text-left">
        {unitsToNext > 0 && nextTierLabel ? (
          <>
            <p className="text-xs text-[#9ca3af]">{t('portal.components.radialTierDonut.remaining')}</p>
            <p className="font-headline text-2xl text-[#e7eaf0]">
              <span className="font-mono tabular-nums">{unitsToNext}</span> {t('portal.components.radialTierDonut.units')}
            </p>
            <p className="text-xs text-[#9ca3af]">
              {t('portal.components.radialTierDonut.to_reach')} <span className="font-medium text-[#f59e0b]">{nextTierLabel}</span>
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-[#9ca3af]">{t('portal.components.radialTierDonut.reached')}</p>
            <p className="font-headline text-2xl text-[#10b981]">{t('portal.components.radialTierDonut.top_tier')}</p>
            <p className="text-xs text-[#9ca3af]">{t('portal.components.radialTierDonut.maintain')}</p>
          </>
        )}
      </div>
    </div>
  );
}
