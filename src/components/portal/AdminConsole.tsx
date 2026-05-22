'use client';

import { useEffect, useState } from 'react';
import { getAdminFleet } from '@/lib/portal-queries';
import type { FleetSummary } from '@/lib/portal-types';

const fmtShortVnd = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0', '') + ' tỷ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'tr';
  return new Intl.NumberFormat('vi-VN').format(n);
};

const tiers = [
  { id: 1, minUnits: 0, percent: 15 },
  { id: 2, minUnits: 101, percent: 20 },
  { id: 3, minUnits: 201, percent: 25 },
];
const tierMax = 201;

const compareUnits = [50, 150, 250];
const priceAvg = 50_000_000;

export function AdminConsole() {
  const [fleet, setFleet] = useState<FleetSummary | null>(null);
  const [scheme, setScheme] = useState<'tier' | 'flat'>('tier');

  useEffect(() => { getAdminFleet().then(setFleet); }, []);

  const f = fleet ?? { active_dealers: 0, units_ytd: 0, units_month: 0, orders_pending: 0, revenue_ytd: 0, commission_pending: 0 };

  return (
    <div className="space-y-12 py-4">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ffb5a1]">Số 05 / 2026 · Toàn fleet</p>
          <h1 className="mt-2 font-headline text-5xl leading-none tracking-tight">
            Bức tranh <span>tháng này</span>.
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#fadcd5]/50">Chế độ commission</p>
          <div className="mt-2 inline-flex rounded-full border border-[#5b4039]/60 p-1">
            <button
              onClick={() => setScheme('tier')}
              className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                scheme === 'tier' ? 'bg-[#ff5626] text-white' : 'text-[#fadcd5]/60'
              }`}
            >
              Tier A
            </button>
            <button
              onClick={() => setScheme('flat')}
              className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                scheme === 'flat' ? 'bg-[#ff5626] text-white' : 'text-[#fadcd5]/60'
              }`}
            >
              Flat B
            </button>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-5">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#fadcd5]/50">Tổng doanh thu YTD</p>
          <p className="mt-2 font-headline text-[64px] leading-[0.85] tracking-tighter md:text-[100px]">
            {fmtShortVnd(f.revenue_ytd).replace(/[^0-9.]/g, '') || '0'}
            <span className="ml-2 align-top font-mono tabular-nums text-3xl text-[#ffb5a1]">tỷ ₫</span>
          </p>
          <p className="mt-3 text-sm text-[#fadcd5]/60">
            <span className="font-mono tabular-nums">{f.units_ytd}</span> máy đã chốt · <span className="font-mono tabular-nums">{f.active_dealers}</span> đại lý active
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:col-span-7">
          {[
            { label: 'Đã bán T05', value: f.units_month, icon: 'sell', chip: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', tone: 'text-emerald-400' },
            { label: 'Đơn chờ duyệt', value: f.orders_pending, icon: 'pending_actions', chip: 'bg-amber-500/10 text-amber-400 border-amber-500/20', tone: 'text-amber-400' },
            { label: 'Đại lý active', value: f.active_dealers, icon: 'groups', chip: 'bg-[#ffb5a1]/10 text-[#ffb5a1] border-[#ffb5a1]/20', tone: 'text-[#ffb5a1]' },
            { label: 'Hoa hồng pending', value: fmtShortVnd(f.commission_pending), icon: 'payments', chip: 'bg-[#84cfff]/10 text-[#84cfff] border-[#84cfff]/20', tone: 'text-[#84cfff]' },
          ].map((k) => (
            <div key={k.label} className="group relative overflow-hidden rounded-xl border border-[#5b4039]/40 bg-[#2c1c17] p-4">
              <div className="pointer-events-none absolute -bottom-4 -right-4 opacity-[0.03] transition-opacity group-hover:opacity-[0.08]">
                <span className="material-symbols-outlined text-[96px]">{k.icon}</span>
              </div>
              <span className={`material-symbols-outlined rounded-lg border p-1.5 text-[20px] ${k.chip}`}>{k.icon}</span>
              <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#fadcd5]/50">{k.label}</p>
              <p className={`mt-1 font-mono tabular-nums text-3xl font-medium ${k.tone}`}>{k.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[#ffb5a1]/25 bg-gradient-to-br from-[#ff5626]/15 to-[#2c1c17] p-6 text-[#fadcd5]">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#ffb5a1]">Đợt chi tiếp theo</p>
        <p className="mt-3 font-headline text-4xl leading-none">
          05<span className="text-[#ffb5a1]">–</span>10<span className="ml-2 text-lg text-[#fadcd5]/60">/06/26</span>
        </p>
        <p className="mt-3 text-sm text-[#fadcd5]/80">
          Tự động chi 5-10 hàng tháng cho mọi đơn approved trước 30/T trước
        </p>
        <p className="mt-1 text-[11px] text-[#fadcd5]/60">
          Tổng dự kiến: <span className="font-mono tabular-nums">{fmtShortVnd(f.commission_pending)}</span> · cho <span className="font-mono tabular-nums">{f.active_dealers}</span> đại lý
        </p>
      </section>

      <section className="rounded-3xl border-2 border-[#5b4039]/50 bg-[#2c1c17] p-8">
        <div className="mb-6 flex items-baseline justify-between border-b border-[#5b4039]/40 pb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#ffb5a1]">Cơ chế hoa hồng</p>
            <h2 className="mt-1 font-headline text-3xl">Hai phương án</h2>
          </div>
          <p className="text-xs text-[#fadcd5]/60">Áp dụng từ 2026-05-22</p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          <div className="rounded-2xl border-2 border-[#ffb5a1] bg-[#ff5626]/5 p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="font-headline text-xl">Phương án A · Tier</h3>
              <span className="rounded-full bg-[#ff5626] px-2 py-0.5 text-[10px] font-medium uppercase text-white">Nâng cấp</span>
            </div>
            <div className="my-6">
              <div className="relative h-2 rounded-full bg-[#372621]">
                {tiers.map((t) => (
                  <div
                    key={t.id}
                    className="absolute -translate-x-1/2"
                    style={{ left: `${Math.min((t.minUnits / tierMax) * 100, 100)}%`, top: '-7px' }}
                  >
                    <div className="h-4 w-4 rounded-full border-2 border-[#ffb5a1] bg-[#1e100c]" />
                  </div>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-3 text-center">
                {tiers.map((t, i) => (
                  <div key={t.id}>
                    <p className="font-mono tabular-nums text-xs text-[#fadcd5]/60">
                      {t.minUnits}{i < tiers.length - 1 ? `–${tiers[i + 1].minUnits - 1}` : '+'} máy
                    </p>
                    <p className="font-headline text-2xl text-[#ffb5a1]">{t.percent}%</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-[#fadcd5]/70">
              Hoa hồng tăng dần theo số máy bán trong năm. Admin/supervisor nâng đại lý lên Tier để thưởng doanh số cao.
            </p>
            <div className="mt-5 space-y-1.5 rounded-xl bg-[#2c1c17] p-4 text-xs">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-[#fadcd5]/50">Thu nhập đại lý YTD</p>
              {compareUnits.map((u) => {
                const tier = tiers.slice().reverse().find((t) => u >= t.minUnits)!;
                const earn = u * priceAvg * (tier.percent / 100);
                return (
                  <div key={u} className="flex justify-between">
                    <span className="font-mono tabular-nums">{u} máy</span>
                    <span>
                      <span className="text-[#ffb5a1]">@{tier.percent}%</span>{' '}
                      <span className="font-mono tabular-nums ml-2 font-medium">{fmtShortVnd(earn)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl border-2 border-[#34d399] bg-[#34d399]/5 p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="font-headline text-xl">Phương án B · Flat</h3>
              <span className="rounded-full bg-[#34d399] px-2 py-0.5 text-[10px] font-medium uppercase text-[#0e1525]">Mặc định</span>
            </div>
            <div className="my-6">
              <div className="relative h-2 rounded-full bg-[#34d399]" />
              <div className="mt-6 text-center">
                <p className="font-headline text-6xl text-[#34d399]">15%</p>
                <p className="text-[10px] uppercase tracking-wider text-[#fadcd5]/50">mọi đơn · mọi đại lý</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-[#fadcd5]/70">
              Mọi tài khoản đại lý mới đăng ký mặc định hưởng 15% trên mọi đơn. Admin/supervisor có thể nâng lên Tier A.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#5b4039]/40 bg-[#2c1c17] p-8 backdrop-blur">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ffb5a1]">Chính sách chi trả</p>
        <h2 className="mt-1 font-headline text-3xl">Tự động · ngày 5–10</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { step: '01', label: 'Khoá kỳ', detail: 'Mọi đơn approved trước 23:59 ngày 30/T sẽ được tính vào đợt chi.' },
            { step: '02', label: 'Tính + duyệt', detail: 'Ngày 1–4: trigger tính commission_payouts, admin sanity check.' },
            { step: '03', label: 'Chi tự động', detail: 'Ngày 5–10: bank batch transfer + Zalo OA notify dealer + supervisor.' },
          ].map((s) => (
            <div key={s.step} className="rounded-xl border border-[#5b4039]/40 bg-[#2c1c17] p-4">
              <p className="font-mono tabular-nums text-3xl text-[#ffb5a1]">{s.step}</p>
              <p className="mt-2 text-sm font-semibold">{s.label}</p>
              <p className="mt-1 text-xs text-[#fadcd5]/60">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
