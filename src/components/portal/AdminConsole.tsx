'use client';

import { useEffect, useState } from 'react';
import { getAdminFleet } from '@/lib/portal-queries';
import type { FleetSummary } from '@/lib/portal-types';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };
const numeric = { fontFamily: 'var(--font-numeric), monospace', fontFeatureSettings: '"tnum"' };

const fmtShortVnd = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0', '') + ' tỷ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'tr';
  return new Intl.NumberFormat('vi-VN').format(n);
};

const tiers = [
  { id: 1, minUnits: 0, percent: 15 },
  { id: 2, minUnits: 100, percent: 20 },
  { id: 3, minUnits: 200, percent: 25 },
  { id: 4, minUnits: 300, percent: 25 },
];

const compareUnits = [50, 150, 250, 350];
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
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#c46a5e]">Số 05 / 2026 · Toàn fleet</p>
          <h1 style={display} className="mt-2 text-5xl font-light leading-none tracking-tight">
            Bức tranh <span className="italic">tháng này</span>.
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#0e1525]/50">Chế độ commission</p>
          <div className="mt-2 inline-flex rounded-full border border-[#0e1525] p-1">
            <button
              onClick={() => setScheme('tier')}
              className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                scheme === 'tier' ? 'bg-[#0e1525] text-[#f5f1e8]' : 'text-[#0e1525]/60'
              }`}
            >
              Tier A
            </button>
            <button
              onClick={() => setScheme('flat')}
              className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                scheme === 'flat' ? 'bg-[#0e1525] text-[#f5f1e8]' : 'text-[#0e1525]/60'
              }`}
            >
              Flat B
            </button>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-12 gap-8">
        <div className="col-span-5">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#0e1525]/50">Tổng doanh thu YTD</p>
          <p style={{ ...display, fontVariationSettings: '"opsz" 144, "SOFT" 100' }} className="mt-2 text-[100px] font-light leading-[0.85] tracking-tighter">
            {fmtShortVnd(f.revenue_ytd).replace(/[^0-9.]/g, '') || '0'}
            <span style={numeric} className="ml-2 align-top text-3xl text-[#c46a5e]">tỷ ₫</span>
          </p>
          <p className="mt-3 text-sm text-[#0e1525]/60">
            <span style={numeric}>{f.units_ytd}</span> máy đã chốt · <span style={numeric}>{f.active_dealers}</span> đại lý active
          </p>
        </div>
        <div className="col-span-7 grid grid-cols-2 gap-3">
          {[
            { label: 'Đã bán T05', value: f.units_month, tone: 'text-[#5d8d6a]' },
            { label: 'Đơn chờ duyệt', value: f.orders_pending, tone: 'text-[#c46a5e]' },
            { label: 'Đại lý active', value: f.active_dealers, tone: 'text-[#bc7e3b]' },
            { label: 'Hoa hồng pending', value: fmtShortVnd(f.commission_pending), tone: 'text-[#0e1525]' },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">{k.label}</p>
              <p style={numeric} className={`mt-2 text-3xl font-medium ${k.tone}`}>{k.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[#0e1525] bg-[#0e1525] p-6 text-[#f5f1e8]">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#c46a5e]">Đợt chi tiếp theo</p>
        <p style={display} className="mt-3 text-4xl font-light leading-none">
          05<span className="text-[#c46a5e]">–</span>10<span className="ml-2 text-lg text-[#f5f1e8]/60">/06/26</span>
        </p>
        <p className="mt-3 text-sm text-[#f5f1e8]/80">
          Tự động chi 5-10 hàng tháng cho mọi đơn approved trước 30/T trước
        </p>
        <p className="mt-1 text-[11px] text-[#f5f1e8]/60">
          Tổng dự kiến: <span style={numeric}>{fmtShortVnd(f.commission_pending)}</span> · cho <span style={numeric}>{f.active_dealers}</span> đại lý
        </p>
      </section>

      <section className="rounded-3xl border-2 border-[#0e1525] bg-white p-8">
        <div className="mb-6 flex items-baseline justify-between border-b border-[#0e1525]/15 pb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#c46a5e]">Quyết định Boss đã chốt</p>
            <h2 style={display} className="mt-1 text-3xl font-light italic">Phương án A — Tier</h2>
          </div>
          <p className="text-xs text-[#0e1525]/60">Áp dụng từ 2026-05-22</p>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div className="rounded-2xl border-2 border-[#bc7e3b] bg-[#bc7e3b]/5 p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 style={display} className="text-xl">Phương án A · Tier (đã chọn)</h3>
              <span className="rounded-full bg-[#bc7e3b] px-2 py-0.5 text-[10px] font-medium uppercase text-white">Đang chạy</span>
            </div>
            <div className="my-6">
              <div className="relative h-2 rounded-full bg-[#0e1525]/10">
                {tiers.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    className="absolute -translate-x-1/2"
                    style={{ left: `${(t.minUnits / 300) * 100}%`, top: '-7px' }}
                  >
                    <div className="h-4 w-4 rounded-full border-2 border-[#bc7e3b] bg-[#f5f1e8]" />
                  </div>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-4 text-center">
                {tiers.slice(0, 4).map((t) => (
                  <div key={t.id}>
                    <p style={numeric} className="text-xs text-[#0e1525]/60">{t.minUnits}+</p>
                    <p style={display} className="text-2xl text-[#bc7e3b]">{t.percent}%</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-[#0e1525]/70">
              Hoa hồng tăng dần theo số máy bán năm. Boss đã chốt phương án này để khuyến khích push tier.
            </p>
            <div className="mt-5 space-y-1.5 rounded-xl bg-[#f5f1e8] p-4 text-xs">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-[#0e1525]/50">Thu nhập đại lý YTD</p>
              {compareUnits.map((u) => {
                const tier = tiers.slice().reverse().find((t) => u >= t.minUnits)!;
                const earn = u * priceAvg * (tier.percent / 100);
                return (
                  <div key={u} className="flex justify-between">
                    <span style={numeric}>{u} máy</span>
                    <span>
                      <span className="text-[#bc7e3b]">@{tier.percent}%</span>{' '}
                      <span style={numeric} className="ml-2 font-medium">{fmtShortVnd(earn)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl border-2 border-[#0e1525]/15 p-6 opacity-60">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 style={display} className="text-xl">Phương án B · Flat (defer)</h3>
            </div>
            <div className="my-6">
              <div className="relative h-2 rounded-full bg-[#5d8d6a]" />
              <div className="mt-6 text-center">
                <p style={display} className="text-6xl text-[#5d8d6a]">20%</p>
                <p className="text-[10px] uppercase tracking-wider text-[#0e1525]/50">mọi đơn · mọi đại lý</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-[#0e1525]/70">
              Phương án dự phòng nếu Tier overhead quá lớn. Có thể switch sau.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#0e1525]/15 bg-white/60 p-8 backdrop-blur">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#bc7e3b]">Chính sách chi trả</p>
        <h2 style={display} className="mt-1 text-3xl font-light italic">Tự động · ngày 5–10</h2>
        <div className="mt-6 grid grid-cols-3 gap-4">
          {[
            { step: '01', label: 'Khoá kỳ', detail: 'Mọi đơn approved trước 23:59 ngày 30/T sẽ được tính vào đợt chi.' },
            { step: '02', label: 'Tính + duyệt', detail: 'Ngày 1–4: trigger tính commission_payouts, admin sanity check.' },
            { step: '03', label: 'Chi tự động', detail: 'Ngày 5–10: bank batch transfer + Zalo OA notify dealer + supervisor.' },
          ].map((s) => (
            <div key={s.step} className="rounded-xl border border-[#0e1525]/10 bg-[#f5f1e8] p-4">
              <p style={numeric} className="text-3xl font-light text-[#bc7e3b]">{s.step}</p>
              <p className="mt-2 text-sm font-semibold">{s.label}</p>
              <p className="mt-1 text-xs text-[#0e1525]/60">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
