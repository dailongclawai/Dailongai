'use client';

import { useEffect, useState } from 'react';
import { getAdminFleet } from '@/lib/portal-queries';
import type { FleetSummary } from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

export function AdminConsole() {
  const [fleet, setFleet] = useState<FleetSummary | null>(null);

  useEffect(() => { getAdminFleet().then(setFleet); }, []);

  const f = fleet ?? { active_dealers: 0, units_ytd: 0, units_month: 0, orders_pending: 0, revenue_ytd: 0, commission_pending: 0 };

  return (
    <div className="space-y-12 py-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Số 05 / 2026 · Toàn fleet</p>
        <h1 className="mt-2 font-headline text-5xl leading-none tracking-tight">
          Bức tranh <span>tháng này</span>.
        </h1>
      </div>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-5">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#e7eaf0]/50">Tổng doanh thu YTD</p>
          <p className="mt-2 font-headline text-[40px] leading-[0.95] tracking-tight md:text-[56px]">
            {fmtVnd(f.revenue_ytd)}
            <span className="ml-2 align-top font-mono tabular-nums text-2xl text-[#ff5625]">₫</span>
          </p>
          <p className="mt-3 text-sm text-[#e7eaf0]/60">
            <span className="font-mono tabular-nums">{f.units_ytd}</span> máy đã chốt · <span className="font-mono tabular-nums">{f.active_dealers}</span> đại lý active
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:col-span-7">
          {[
            { label: 'Đã bán T05', value: f.units_month, icon: 'sell', chip: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', tone: 'text-emerald-400' },
            { label: 'Đơn chờ duyệt', value: f.orders_pending, icon: 'pending_actions', chip: 'bg-amber-500/10 text-amber-400 border-amber-500/20', tone: 'text-amber-400' },
            { label: 'Đại lý active', value: f.active_dealers, icon: 'groups', chip: 'bg-[#ff5625]/10 text-[#ff5625] border-[#ff5625]/20', tone: 'text-[#ff5625]' },
            { label: 'Hoa hồng pending', value: fmtVnd(f.commission_pending), icon: 'payments', chip: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20', tone: 'text-[#3b82f6]' },
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
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff5625]">Đợt chi tiếp theo</p>
        <p className="mt-3 font-headline text-4xl leading-none">
          05<span className="text-[#ff5625]">–</span>10<span className="ml-2 text-lg text-[#e7eaf0]/60">/06/26</span>
        </p>
        <p className="mt-3 text-sm text-[#e7eaf0]/80">
          Tự động chi 5-10 hàng tháng cho mọi đơn approved trước 30/T trước
        </p>
        <p className="mt-1 text-[11px] text-[#e7eaf0]/60">
          Tổng dự kiến: <span className="font-mono tabular-nums">{fmtVnd(f.commission_pending)}</span> · cho <span className="font-mono tabular-nums">{f.active_dealers}</span> đại lý
        </p>
      </section>

<section className="rounded-3xl border border-[#1f2937]/40 bg-[#11151a] p-8 backdrop-blur">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">Chính sách chi trả</p>
        <h2 className="mt-1 font-headline text-3xl">Tự động · ngày 5–10</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { step: '01', label: 'Khoá kỳ', detail: 'Mọi đơn approved trước 23:59 ngày 30/T sẽ được tính vào đợt chi.' },
            { step: '02', label: 'Tính + duyệt', detail: 'Ngày 1–4: trigger tính commission_payouts, admin sanity check.' },
            { step: '03', label: 'Chi tự động', detail: 'Ngày 5–10: bank batch transfer + Zalo OA notify dealer + supervisor.' },
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
