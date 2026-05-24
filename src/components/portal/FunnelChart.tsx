'use client';

import { useEffect, useState } from 'react';
import { getSupervisorFunnel, getDealerQrFunnel, type SupervisorFunnel, type DealerQrFunnel } from '@/lib/portal-queries';
import { useI18n } from '@/lib/i18n';

const numFmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

interface Stage {
  label: string;
  value: number;
  color: string;
}

function FunnelBars({ stages, conversion }: { stages: Stage[]; conversion: string }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-2">
        {stages.map((s, idx) => {
          const prevValue = idx > 0 ? stages[idx - 1].value : null;
          const keepPct = prevValue !== null && prevValue > 0
            ? Math.round((s.value / prevValue) * 100)
            : null;
          const isFilled = s.value > 0;
          return (
            <div key={s.label} className="flex flex-col gap-2 md:flex-1 md:gap-1">
              <div className="flex items-center gap-3 md:flex-col md:items-stretch md:gap-1">
                <div
                  className="flex flex-1 flex-col rounded-2xl border p-3 transition-colors md:p-4"
                  style={{
                    borderColor: isFilled ? `${s.color}55` : '#1f2937',
                    background: isFilled
                      ? `linear-gradient(135deg, ${s.color}1a 0%, transparent 80%)`
                      : '#0a0c0f',
                  }}
                >
                  <span className="text-[10px] uppercase tracking-wider text-[#9ca3af]">{s.label}</span>
                  <span
                    className="mt-1 font-headline text-2xl tabular-nums md:text-3xl"
                    style={{ color: isFilled ? s.color : '#9ca3af' }}
                  >
                    {numFmt(s.value)}
                  </span>
                </div>
                {idx < stages.length - 1 && (
                  <div className="flex shrink-0 items-center justify-center gap-1 md:flex-row md:py-2">
                    <span className="font-mono text-[10px] tabular-nums text-[#9ca3af]">
                      {keepPct !== null ? `${keepPct}%` : '—'}
                    </span>
                    <span className="text-[#9ca3af]" aria-hidden="true">
                      <span className="inline md:hidden">↓</span>
                      <span className="hidden md:inline">→</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-right text-[11px] text-[#9ca3af]">
        {t('portal.components.funnelChart.conversion_label')}: <span className="font-mono font-semibold tabular-nums text-[#10b981]">{conversion}</span>
      </p>
    </div>
  );
}

interface SupervisorFunnelProps {
  supervisorId?: string;
}

export function SupervisorFunnelCard({ supervisorId }: SupervisorFunnelProps) {
  const { t } = useI18n();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<SupervisorFunnel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSupervisorFunnel(days, supervisorId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days, supervisorId]);

  const stages: Stage[] = [
    { label: t('portal.components.funnelChart.supervisor_stage_visitor'), value: data?.unique_visitors ?? 0, color: '#3b82f6' },
    { label: t('portal.components.funnelChart.supervisor_stage_signup'), value: data?.signups ?? 0, color: '#ff5625' },
    { label: t('portal.components.funnelChart.supervisor_stage_first_order'), value: data?.first_orders ?? 0, color: '#10b981' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-[#1f2937]/40 bg-[#11151a] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[#3b82f6]">filter_alt</span>
          <p className="text-sm font-semibold">{t('portal.components.funnelChart.supervisor_title')}</p>
        </div>
        <div className="inline-flex gap-1 rounded-lg border border-[#1f2937]/40 bg-[#06080a]/40 p-0.5 text-[10px]">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                days === d ? 'bg-[#ff5625] text-white' : 'text-[#e7eaf0]/60 hover:text-[#e7eaf0]'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="h-24 animate-pulse rounded-lg bg-[#1a1f26]/40" />
      ) : (data?.unique_visitors ?? 0) === 0 && (data?.signups ?? 0) === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#1f2937]/40 bg-[#06080a]/30 p-6 text-center text-xs text-[#e7eaf0]/40">
          <span className="material-symbols-outlined text-[28px] text-[#e7eaf0]/30">qr_code_scanner</span>
          <p>{t('portal.components.funnelChart.supervisor_empty_prefix')} {days} {t('portal.components.funnelChart.empty_days_suffix')}</p>
          <p>{t('portal.components.funnelChart.supervisor_empty_hint')}</p>
        </div>
      ) : (
        <>
          <FunnelBars stages={stages} conversion={`${data?.view_to_order_pct ?? 0}% ${t('portal.components.funnelChart.supervisor_view_to_first_order')}`} />
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#1f2937]/30 pt-3 text-center text-[10px]">
            <div>
              <p className="uppercase tracking-wider text-[#e7eaf0]/40">{t('portal.components.funnelChart.views_label')}</p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums">{numFmt(data?.views ?? 0)}</p>
            </div>
            <div className="border-x border-[#1f2937]/30">
              <p className="uppercase tracking-wider text-[#e7eaf0]/40">{t('portal.components.funnelChart.view_to_signup')}</p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-[#ff5625]">{data?.view_to_signup_pct ?? 0}%</p>
            </div>
            <div>
              <p className="uppercase tracking-wider text-[#e7eaf0]/40">{t('portal.components.funnelChart.signup_to_order')}</p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-[#10b981]">{data?.signup_to_order_pct ?? 0}%</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface DealerFunnelProps {
  dealerId?: string;
}

export function DealerQrFunnelCard({ dealerId }: DealerFunnelProps) {
  const { t } = useI18n();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<DealerQrFunnel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDealerQrFunnel(days, dealerId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days, dealerId]);

  const stages: Stage[] = [
    { label: t('portal.components.funnelChart.dealer_stage_visitor'), value: data?.unique_visitors ?? 0, color: '#3b82f6' },
    { label: t('portal.components.funnelChart.dealer_stage_order'), value: data?.orders_via_qr ?? 0, color: '#10b981' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-[#1f2937]/40 bg-[#11151a] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[#3b82f6]">qr_code_scanner</span>
          <p className="text-sm font-semibold">{t('portal.components.funnelChart.dealer_title')}</p>
        </div>
        <div className="inline-flex gap-1 rounded-lg border border-[#1f2937]/40 bg-[#06080a]/40 p-0.5 text-[10px]">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                days === d ? 'bg-[#ff5625] text-white' : 'text-[#e7eaf0]/60 hover:text-[#e7eaf0]'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="h-24 animate-pulse rounded-lg bg-[#1a1f26]/40" />
      ) : (data?.unique_visitors ?? 0) === 0 && (data?.orders_via_qr ?? 0) === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#1f2937]/40 bg-[#06080a]/30 p-6 text-center text-xs text-[#e7eaf0]/40">
          <span className="material-symbols-outlined text-[28px] text-[#e7eaf0]/30">qr_code_scanner</span>
          <p>{t('portal.components.funnelChart.dealer_empty_prefix')} {days} {t('portal.components.funnelChart.empty_days_suffix')}</p>
          <p>{t('portal.components.funnelChart.dealer_empty_hint')}</p>
        </div>
      ) : (
        <>
          <FunnelBars stages={stages} conversion={`${data?.conversion_pct ?? 0}% ${t('portal.components.funnelChart.dealer_view_to_order')}`} />
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#1f2937]/30 pt-3 text-center text-[10px]">
            <div>
              <p className="uppercase tracking-wider text-[#e7eaf0]/40">{t('portal.components.funnelChart.views_label')}</p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums">{numFmt(data?.views ?? 0)}</p>
            </div>
            <div className="border-l border-[#1f2937]/30">
              <p className="uppercase tracking-wider text-[#e7eaf0]/40">{t('portal.components.funnelChart.conversion_label')}</p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-[#10b981]">{data?.conversion_pct ?? 0}%</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
