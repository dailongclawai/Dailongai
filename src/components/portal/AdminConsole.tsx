'use client';

import { useEffect, useState } from 'react';
import { getAdminFleet } from '@/lib/portal-queries';
import type { FleetSummary } from '@/lib/portal-types';
import { useI18n } from '@/lib/i18n';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

export function AdminConsole() {
  const { t } = useI18n();
  const [fleet, setFleet] = useState<FleetSummary | null>(null);

  useEffect(() => { getAdminFleet().then(setFleet); }, []);

  const f = fleet ?? { active_dealers: 0, units_ytd: 0, units_month: 0, orders_pending: 0, revenue_ytd: 0, commission_pending: 0 };

  return (
    <div className="space-y-12 py-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.components.adminConsole.header_kicker')}</p>
        <h1 className="mt-2 font-headline text-5xl leading-none tracking-tight">
          {t('portal.components.adminConsole.header_title_prefix')} <span>{t('portal.components.adminConsole.header_title_highlight')}</span>.
        </h1>
      </div>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-5">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#e7eaf0]/50">{t('portal.components.adminConsole.revenue_ytd')}</p>
          <p className="mt-2 font-headline text-[40px] leading-[0.95] tracking-tight md:text-[56px]">
            {fmtVnd(f.revenue_ytd)}
            <span className="ml-2 align-top font-mono tabular-nums text-2xl text-[#ff5625]">₫</span>
          </p>
          <p className="mt-3 text-sm text-[#e7eaf0]/60">
            <span className="font-mono tabular-nums">{f.units_ytd}</span> {t('portal.components.adminConsole.units_closed')} · <span className="font-mono tabular-nums">{f.active_dealers}</span> {t('portal.components.adminConsole.active_dealers')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:col-span-7">
          {[
            { label: t('portal.components.adminConsole.kpi_sold_month'), value: f.units_month, icon: 'sell', chip: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', tone: 'text-emerald-400' },
            { label: t('portal.components.adminConsole.kpi_orders_pending'), value: f.orders_pending, icon: 'pending_actions', chip: 'bg-amber-500/10 text-amber-400 border-amber-500/20', tone: 'text-amber-400' },
            { label: t('portal.components.adminConsole.kpi_active_dealers'), value: f.active_dealers, icon: 'groups', chip: 'bg-[#ff5625]/10 text-[#ff5625] border-[#ff5625]/20', tone: 'text-[#ff5625]' },
            { label: t('portal.components.adminConsole.kpi_commission_pending'), value: fmtVnd(f.commission_pending), icon: 'payments', chip: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20', tone: 'text-[#3b82f6]' },
          ].map((k) => (
            <div key={k.label} className="group relative overflow-hidden rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-4">
              <div className="pointer-events-none absolute -bottom-4 -right-4 opacity-[0.03] transition-opacity group-hover:opacity-[0.08]">
                <span className="material-symbols-outlined text-[96px]">{k.icon}</span>
              </div>
              <span className={`material-symbols-outlined rounded-lg border p-1.5 text-[20px] ${k.chip}`}>{k.icon}</span>
              <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">{k.label}</p>
              <p className={`mt-1 font-mono tabular-nums text-3xl font-medium ${k.tone}`}>{k.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[#ff5625]/25 bg-gradient-to-br from-[#ff5625]/15 to-[#1e2022] p-6 text-[#e7eaf0]">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.components.adminConsole.next_payout_kicker')}</p>
        <p className="mt-3 font-headline text-4xl leading-none">
          05<span className="text-[#ff5625]">–</span>10<span className="ml-2 text-lg text-[#e7eaf0]/60">/06/26</span>
        </p>
        <p className="mt-3 text-sm text-[#e7eaf0]/80">
          {t('portal.components.adminConsole.next_payout_desc')}
        </p>
        <p className="mt-1 text-[11px] text-[#e7eaf0]/60">
          {t('portal.components.adminConsole.next_payout_total_prefix')} <span className="font-mono tabular-nums">{fmtVnd(f.commission_pending)}</span> · {t('portal.components.adminConsole.next_payout_for')} <span className="font-mono tabular-nums">{f.active_dealers}</span> {t('portal.components.adminConsole.next_payout_dealers')}
        </p>
      </section>

<section className="rounded-3xl border border-[#1f2937]/40 bg-[#11151a] p-8 backdrop-blur">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.components.adminConsole.policy_kicker')}</p>
        <h2 className="mt-1 font-headline text-3xl">{t('portal.components.adminConsole.policy_title')}</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { step: '01', label: t('portal.components.adminConsole.policy_step1_label'), detail: t('portal.components.adminConsole.policy_step1_detail') },
            { step: '02', label: t('portal.components.adminConsole.policy_step2_label'), detail: t('portal.components.adminConsole.policy_step2_detail') },
            { step: '03', label: t('portal.components.adminConsole.policy_step3_label'), detail: t('portal.components.adminConsole.policy_step3_detail') },
          ].map((s) => (
            <div key={s.step} className="rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-4">
              <p className="font-mono tabular-nums text-3xl text-[#ff5625]">{s.step}</p>
              <p className="mt-2 text-sm font-semibold">{s.label}</p>
              <p className="mt-1 text-xs text-[#e7eaf0]/60">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
