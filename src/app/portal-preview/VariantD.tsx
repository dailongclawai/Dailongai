'use client';
// PROTOTYPE — VariantD: Editorial Medical Infographic dealer dashboard
// Aesthetic: cream paper + ink navy + warm copper + Fraunces serif numerals

import {
  mockDealer,
  mockKpi,
  mockMonthlySeries,
  mockOrders,
  fmtVnd,
  fmtShortVnd,
  statusLabel,
  tierScheme,
  mockDealerYtd,
  nextPayout,
} from './mock-data';

export const variantDName = 'Editorial Infographic ⭐';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };
const numeric = { fontFamily: 'var(--font-numeric), monospace', fontFeatureSettings: '"tnum"' };

export function VariantD() {
  const tier3 = tierScheme.tiers.find((t) => t.id === 3)!;
  const currentTier = tierScheme.tiers.slice().reverse().find((t) => mockDealerYtd.unitsYtd >= t.minUnits)!;
  const nextTier = tierScheme.tiers.find((t) => t.minUnits > mockDealerYtd.unitsYtd) ?? tier3;
  const unitsToNext = Math.max(0, nextTier.minUnits - mockDealerYtd.unitsYtd);
  const tierProgressPct = nextTier.minUnits === 0
    ? 100
    : Math.min(100, (mockDealerYtd.unitsYtd / nextTier.minUnits) * 100);

  const ladderMax = 300;

  return (
    <div className="relative mx-auto max-w-[1240px] px-8 py-10">
      {/* ─── Editorial nav strip ─── */}
      <header className="flex items-baseline justify-between border-b border-[#0e1525]/15 pb-4">
        <div className="flex items-baseline gap-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#0e1525]/60">Đại Long Portal</p>
          <span className="h-1 w-1 rounded-full bg-[#bc7e3b]" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#0e1525]/60">Phiên bản đại lý</p>
        </div>
        <nav className="flex items-center gap-8 text-[13px]">
          <a className="border-b-2 border-[#0e1525] pb-1 font-semibold">Dashboard</a>
          <a className="text-[#0e1525]/60 hover:text-[#0e1525]">Đơn hàng</a>
          <a className="text-[#0e1525]/60 hover:text-[#0e1525]">Hoa hồng</a>
          <a className="text-[#0e1525]/60 hover:text-[#0e1525]">Tài liệu</a>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0e1525] text-xs font-semibold text-[#f5f1e8]">
            {mockDealer.avatar}
          </div>
        </nav>
      </header>

      {/* ─── Date + section heading ─── */}
      <div className="mt-8 flex items-baseline justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#bc7e3b]">Số 05 / 2026 · Báo cáo tháng</p>
          <h1 style={display} className="mt-2 text-5xl font-light leading-none tracking-tight">
            Chào <span className="italic">{mockDealer.fullName.split(' ').slice(-1)[0]}</span>.
          </h1>
        </div>
        <button className="group relative overflow-hidden rounded-full border border-[#0e1525] bg-[#0e1525] px-6 py-2.5 text-sm font-medium text-[#f5f1e8] transition-all hover:bg-[#bc7e3b] hover:border-[#bc7e3b]">
          <span className="relative">+ Ghi nhận đơn mới</span>
        </button>
      </div>

      {/* ─── Hero infographic: month sales + tier ladder ─── */}
      <section className="mt-12 grid grid-cols-12 gap-10">
        {/* Big number */}
        <div className="col-span-7">
          <p className="text-xs uppercase tracking-[0.25em] text-[#0e1525]/50">Doanh số tháng này</p>
          <p style={{ ...display, fontVariationSettings: '"opsz" 144, "SOFT" 100' }} className="mt-3 text-[140px] font-light leading-[0.85] tracking-tighter">
            245
            <span style={numeric} className="ml-2 align-top text-3xl text-[#bc7e3b]">tr ₫</span>
          </p>
          <div className="mt-4 flex items-center gap-6 text-sm">
            <span className="flex items-center gap-1 text-[#5d8d6a]">
              <svg width="14" height="14" viewBox="0 0 14 14" className="inline">
                <path d="M2 10 L7 4 L12 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
              <span style={numeric}>+44%</span> <span className="text-[#0e1525]/50">vs T04</span>
            </span>
            <span className="text-[#0e1525]/50">·</span>
            <span className="text-[#0e1525]/70">
              <span style={numeric}>5</span> máy đã bán · <span style={numeric}>{fmtShortVnd(49_000_000)}</span> trung bình/máy
            </span>
          </div>

          {/* sparkline 6 months */}
          <div className="mt-8">
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#0e1525]/50">6 tháng gần nhất</p>
            <svg viewBox="0 0 480 80" className="mt-2 h-16 w-full">
              <defs>
                <linearGradient id="vd-grad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#bc7e3b" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#bc7e3b" stopOpacity="0" />
                </linearGradient>
              </defs>
              {(() => {
                const max = Math.max(...mockMonthlySeries.map((m) => m.sales));
                const pts = mockMonthlySeries.map((m, i) => {
                  const x = (i / (mockMonthlySeries.length - 1)) * 480;
                  const y = 70 - (m.sales / max) * 60;
                  return { x, y, sales: m.sales, month: m.month };
                });
                const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
                const area = `${path} L480,80 L0,80 Z`;
                return (
                  <>
                    <path d={area} fill="url(#vd-grad)" />
                    <path d={path} stroke="#bc7e3b" strokeWidth="1.5" fill="none" />
                    {pts.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r="2.5" fill="#bc7e3b" />
                        <text x={p.x} y="78" textAnchor="middle" fontSize="8" fill="#0e1525" opacity="0.5">
                          {p.month.split('/')[0]}
                        </text>
                      </g>
                    ))}
                  </>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* Sidebar: Payment date + KPI mini cards */}
        <div className="col-span-5 space-y-4">
          {/* Payment callout */}
          <div className="relative overflow-hidden rounded-2xl border border-[#0e1525] bg-[#0e1525] p-6 text-[#f5f1e8]">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#bc7e3b]/20 blur-3xl" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#bc7e3b]">Kỳ chi trả kế tiếp</p>
            <p style={display} className="mt-3 text-5xl font-light leading-none">
              05<span className="text-[#bc7e3b]">–</span>10
              <span className="ml-2 text-xl text-[#f5f1e8]/60">/06</span>
            </p>
            <p className="mt-3 text-sm text-[#f5f1e8]/80">Hoa hồng dự kiến chi vào tài khoản đăng ký</p>
            <div className="mt-5 flex items-baseline gap-2">
              <span style={numeric} className="text-3xl font-medium text-[#f5f1e8]">
                {fmtShortVnd(nextPayout.expectedAmount)}
              </span>
              <span className="text-xs text-[#f5f1e8]/60">VND dự kiến</span>
            </div>
            <p className="mt-2 text-[11px] text-[#f5f1e8]/50">
              Tự động chi 5–10 hàng tháng cho mọi đơn `approved` trước 30/T trước
            </p>
          </div>

          {/* KPI trio */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-4 backdrop-blur">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Đơn chờ duyệt</p>
              <p style={numeric} className="mt-2 text-3xl font-medium">{mockKpi.ordersPending}</p>
              <p className="text-xs text-[#bc7e3b]">{fmtShortVnd(mockKpi.commissionPending)} treo</p>
            </div>
            <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-4 backdrop-blur">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Đã chốt</p>
              <p style={numeric} className="mt-2 text-3xl font-medium">
                {mockKpi.ordersPaid + mockKpi.ordersApproved}
              </p>
              <p className="text-xs text-[#0e1525]/60">tổng tháng</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Tier ladder ─── */}
      <section className="mt-16 rounded-3xl border border-[#0e1525]/15 bg-white/50 p-8 backdrop-blur">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#bc7e3b]">Bậc hoa hồng</p>
            <h2 style={display} className="mt-1 text-2xl font-light italic">
              Tier {currentTier.id} · {currentTier.percent}%
            </h2>
          </div>
          <p className="text-xs text-[#0e1525]/60">
            Tính theo số máy bán năm 2026 (YTD: <span style={numeric}>{mockDealerYtd.unitsYtd}</span> máy)
          </p>
        </div>

        {/* The ladder itself */}
        <div className="mt-10">
          <div className="relative h-1 rounded-full bg-[#0e1525]/10">
            <div
              className="absolute left-0 top-0 h-1 rounded-full bg-gradient-to-r from-[#bc7e3b] to-[#d8a86a]"
              style={{ width: `${(mockDealerYtd.unitsYtd / ladderMax) * 100}%` }}
            />
            {tierScheme.tiers.slice(0, 4).map((t) => {
              const pct = (t.minUnits / ladderMax) * 100;
              const isReached = mockDealerYtd.unitsYtd >= t.minUnits;
              return (
                <div
                  key={t.id}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${Math.min(pct, 100)}%`, top: '-6px' }}
                >
                  <div
                    className={`h-4 w-4 rounded-full border-2 ${
                      isReached
                        ? 'border-[#bc7e3b] bg-[#bc7e3b]'
                        : 'border-[#0e1525]/30 bg-[#f5f1e8]'
                    }`}
                  />
                </div>
              );
            })}
            {/* Position indicator */}
            <div
              className="absolute -translate-x-1/2"
              style={{ left: `${(mockDealerYtd.unitsYtd / ladderMax) * 100}%`, top: '-10px' }}
            >
              <div className="flex flex-col items-center">
                <div className="h-6 w-0.5 bg-[#0e1525]" />
                <span style={numeric} className="mt-1 whitespace-nowrap rounded-md bg-[#0e1525] px-2 py-0.5 text-[10px] font-medium text-[#f5f1e8]">
                  Bạn · {mockDealerYtd.unitsYtd}
                </span>
              </div>
            </div>
          </div>

          {/* Tier labels */}
          <div className="mt-12 grid grid-cols-4 text-sm">
            {tierScheme.tiers.slice(0, 4).map((t) => {
              const isReached = mockDealerYtd.unitsYtd >= t.minUnits;
              const isCurrent = t.id === currentTier.id;
              return (
                <div key={t.id} className={isCurrent ? 'opacity-100' : 'opacity-50'}>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[#0e1525]/50">{t.label}</p>
                  <p style={numeric} className="mt-1 text-lg font-medium">{t.minUnits}+ máy</p>
                  <p style={display} className={`text-2xl ${isReached ? 'text-[#bc7e3b]' : 'text-[#0e1525]'}`}>
                    {t.percent}%
                  </p>
                </div>
              );
            })}
          </div>

          {/* CTA next milestone */}
          {unitsToNext > 0 && (
            <div className="mt-8 flex items-center gap-3 rounded-xl bg-[#bc7e3b]/10 px-4 py-3 text-sm">
              <span className="font-semibold text-[#bc7e3b]">▲</span>
              <span>
                Còn <span style={numeric} className="font-semibold">{unitsToNext}</span> máy nữa lên{' '}
                <span className="font-semibold">{nextTier.label} · {nextTier.percent}%</span>{' '}
                — tăng <span style={numeric}>+{nextTier.percent - currentTier.percent}%</span> trên mọi đơn từ thời điểm đạt.
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ─── Recent orders editorial timeline ─── */}
      <section className="mt-16">
        <div className="flex items-baseline justify-between border-b border-[#0e1525]/15 pb-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#bc7e3b]">Hoạt động</p>
            <h2 style={display} className="mt-1 text-3xl font-light italic">Đơn gần đây</h2>
          </div>
          <a className="text-xs uppercase tracking-[0.2em] text-[#0e1525]/60 hover:text-[#bc7e3b]">
            Tất cả →
          </a>
        </div>

        <div className="mt-6 divide-y divide-[#0e1525]/10">
          {mockOrders.map((o, i) => (
            <article key={o.id} className="grid grid-cols-12 items-center gap-4 py-5">
              <div className="col-span-1">
                <span style={numeric} className="text-2xl text-[#0e1525]/30">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <div className="col-span-1">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusLabel[o.status].tone}`}>
                  {statusLabel[o.status].vi}
                </span>
              </div>
              <div className="col-span-4">
                <p className="text-[15px] font-medium">{o.customer}</p>
                <p className="text-xs text-[#0e1525]/50" style={numeric}>{o.serial} · {o.date}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-wider text-[#0e1525]/50">{o.model}</p>
              </div>
              <div className="col-span-2 text-right">
                <p style={numeric} className="text-lg font-medium">{fmtShortVnd(o.price)}</p>
                <p className="text-[10px] text-[#0e1525]/50">giá bán</p>
              </div>
              <div className="col-span-2 text-right">
                <p style={numeric} className="text-lg font-medium text-[#5d8d6a]">+{fmtShortVnd(o.commission)}</p>
                <p className="text-[10px] text-[#0e1525]/50">hoa hồng</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ─── Footer note ─── */}
      <footer className="mt-20 flex items-center justify-between border-t border-[#0e1525]/15 pt-6 text-[11px] text-[#0e1525]/50">
        <p>© Đại Long — công nghệ chăm sóc sức khoẻ · Portal đại lý phân phối</p>
        <a href="/portal-preview/admin" className="hover:text-[#bc7e3b]">Vào Admin Console →</a>
      </footer>
    </div>
  );
}
