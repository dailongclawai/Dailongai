'use client';
// Editorial Infographic dealer dashboard — folded from /portal-preview Variant D.
// Mock numbers for v1; Plan 3 wires real orders/commissions via Supabase.

import type { Profile } from '@/lib/portal-types';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };
const numeric = { fontFamily: 'var(--font-numeric), monospace', fontFeatureSettings: '"tnum"' };

const fmtShortVnd = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0', '') + ' tỷ';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'tr';
  return new Intl.NumberFormat('vi-VN').format(n);
};

const tiers = [
  { id: 1, label: 'Tier 1', minUnits: 0, percent: 15 },
  { id: 2, label: 'Tier 2', minUnits: 100, percent: 20 },
  { id: 3, label: 'Tier 3', minUnits: 200, percent: 25 },
  { id: 4, label: 'Tier 4', minUnits: 300, percent: 25 },
];

// Placeholder data — will be replaced by Supabase queries in Plan 3
const mock = {
  monthSales: 0,
  commissionPending: 0,
  ordersPending: 0,
  ordersPaid: 0,
  ordersApproved: 0,
  unitsYtd: 0,
  monthlySeries: [
    { month: 'T12/25', sales: 0 },
    { month: 'T01/26', sales: 0 },
    { month: 'T02/26', sales: 0 },
    { month: 'T03/26', sales: 0 },
    { month: 'T04/26', sales: 0 },
    { month: 'T05/26', sales: 0 },
  ],
  recentOrders: [] as Array<{ id: string; serial: string; customer: string; model: string; price: number; date: string; status: string; commission: number }>,
};

export function DealerDashboard({ profile }: { profile: Profile }) {
  const currentTier = tiers.slice().reverse().find((t) => mock.unitsYtd >= t.minUnits)!;
  const nextTier = tiers.find((t) => t.minUnits > mock.unitsYtd) ?? currentTier;
  const unitsToNext = Math.max(0, nextTier.minUnits - mock.unitsYtd);
  const ladderMax = 300;
  const firstName = profile.full_name?.split(' ').slice(-1)[0] ?? 'Đại lý';

  return (
    <div className="space-y-12 py-4">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#bc7e3b]">Số 05 / 2026 · Báo cáo tháng</p>
          <h1 style={display} className="mt-2 text-5xl font-light leading-none tracking-tight">
            Chào <span className="italic">{firstName}</span>.
          </h1>
        </div>
        <button className="rounded-full border border-[#0e1525] bg-[#0e1525] px-6 py-2.5 text-sm font-medium text-[#f5f1e8] hover:bg-[#bc7e3b] hover:border-[#bc7e3b]">
          + Ghi nhận đơn mới
        </button>
      </div>

      <section className="grid grid-cols-12 gap-10">
        <div className="col-span-7">
          <p className="text-xs uppercase tracking-[0.25em] text-[#0e1525]/50">Doanh số tháng này</p>
          <p style={{ ...display, fontVariationSettings: '"opsz" 144, "SOFT" 100' }} className="mt-3 text-[140px] font-light leading-[0.85] tracking-tighter">
            {fmtShortVnd(mock.monthSales).replace(/[^0-9]/g, '') || '0'}
            <span style={numeric} className="ml-2 align-top text-3xl text-[#bc7e3b]">
              {mock.monthSales >= 1_000_000 ? 'tr ₫' : '₫'}
            </span>
          </p>
          <p className="mt-4 text-sm text-[#0e1525]/60">
            <span style={numeric}>{mock.ordersPaid + mock.ordersApproved}</span> máy đã chốt tháng này
          </p>
          <p className="mt-2 text-xs italic text-[#0e1525]/40">
            (Plan 3 sẽ wire dữ liệu thật từ bảng orders + commission_payouts)
          </p>
        </div>

        <div className="col-span-5 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-[#0e1525] bg-[#0e1525] p-6 text-[#f5f1e8]">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#bc7e3b]">Kỳ chi trả kế tiếp</p>
            <p style={display} className="mt-3 text-5xl font-light leading-none">
              05<span className="text-[#bc7e3b]">–</span>10<span className="ml-2 text-xl text-[#f5f1e8]/60">/06</span>
            </p>
            <p className="mt-3 text-sm text-[#f5f1e8]/80">Tự động chi 5–10 hàng tháng cho mọi đơn approved</p>
            <p className="mt-2 text-[11px] text-[#f5f1e8]/50">
              Đợt này: <span style={numeric}>{fmtShortVnd(mock.commissionPending)}</span> VND dự kiến
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Đơn chờ duyệt</p>
              <p style={numeric} className="mt-2 text-3xl font-medium">{mock.ordersPending}</p>
            </div>
            <div className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">Đã chốt</p>
              <p style={numeric} className="mt-2 text-3xl font-medium">{mock.ordersPaid + mock.ordersApproved}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#0e1525]/15 bg-white/50 p-8 backdrop-blur">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#bc7e3b]">Bậc hoa hồng năm 2026</p>
            <h2 style={display} className="mt-1 text-2xl font-light italic">
              {currentTier.label} · {currentTier.percent}%
            </h2>
          </div>
          <p className="text-xs text-[#0e1525]/60">
            YTD: <span style={numeric}>{mock.unitsYtd}</span> máy
          </p>
        </div>
        <div className="mt-10">
          <div className="relative h-1 rounded-full bg-[#0e1525]/10">
            <div
              className="absolute left-0 top-0 h-1 rounded-full bg-gradient-to-r from-[#bc7e3b] to-[#d8a86a]"
              style={{ width: `${(mock.unitsYtd / ladderMax) * 100}%` }}
            />
            {tiers.slice(0, 4).map((t) => (
              <div
                key={t.id}
                className="absolute -translate-x-1/2"
                style={{ left: `${Math.min((t.minUnits / ladderMax) * 100, 100)}%`, top: '-6px' }}
              >
                <div
                  className={`h-4 w-4 rounded-full border-2 ${
                    mock.unitsYtd >= t.minUnits ? 'border-[#bc7e3b] bg-[#bc7e3b]' : 'border-[#0e1525]/30 bg-[#f5f1e8]'
                  }`}
                />
              </div>
            ))}
          </div>
          <div className="mt-12 grid grid-cols-4 text-sm">
            {tiers.slice(0, 4).map((t) => (
              <div key={t.id} className={t.id === currentTier.id ? 'opacity-100' : 'opacity-50'}>
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#0e1525]/50">{t.label}</p>
                <p style={numeric} className="mt-1 text-lg font-medium">{t.minUnits}+ máy</p>
                <p style={display} className={`text-2xl ${mock.unitsYtd >= t.minUnits ? 'text-[#bc7e3b]' : 'text-[#0e1525]'}`}>
                  {t.percent}%
                </p>
              </div>
            ))}
          </div>
          {unitsToNext > 0 && (
            <div className="mt-8 flex items-center gap-3 rounded-xl bg-[#bc7e3b]/10 px-4 py-3 text-sm">
              <span className="font-semibold text-[#bc7e3b]">▲</span>
              <span>
                Còn <span style={numeric} className="font-semibold">{unitsToNext}</span> máy nữa lên{' '}
                <span className="font-semibold">{nextTier.label} · {nextTier.percent}%</span>
              </span>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between border-b border-[#0e1525]/15 pb-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#bc7e3b]">Hoạt động</p>
            <h2 style={display} className="mt-1 text-3xl font-light italic">Đơn gần đây</h2>
          </div>
        </div>
        {mock.recentOrders.length === 0 ? (
          <div className="mt-6 rounded-xl border-2 border-dashed border-[#0e1525]/15 p-12 text-center text-sm text-[#0e1525]/60">
            <p>Chưa có đơn nào ghi nhận.</p>
            <p className="mt-2 text-xs italic text-[#0e1525]/40">
              Bấm “Ghi nhận đơn mới” phía trên để tạo đơn đầu tiên (sẽ live ở Plan 3).
            </p>
          </div>
        ) : (
          <div className="mt-6 divide-y divide-[#0e1525]/10">
            {/* Plan 3 renders order rows here */}
          </div>
        )}
      </section>
    </div>
  );
}
