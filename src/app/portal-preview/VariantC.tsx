'use client';
// PROTOTYPE — VariantC: Mobile-First Stacked Feed (big number + timeline)

import { mockDealer, mockKpi, mockOrders, fmtVnd, fmtShortVnd, statusLabel } from './mock-data';

export const variantCName = 'Mobile-first Feed';

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' });
};

export function VariantC() {
  return (
    <div className="mx-auto max-w-md min-h-screen bg-slate-100 pb-24">
      <header className="bg-white px-5 pb-6 pt-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 font-semibold text-white">
            {mockDealer.avatar}
          </div>
          <div>
            <p className="text-xs text-slate-500">Xin chào,</p>
            <p className="font-semibold text-slate-900">{mockDealer.fullName}</p>
          </div>
          <button className="ml-auto rounded-full p-2 hover:bg-slate-100" aria-label="Thông báo">
            <span className="block h-2 w-2 rounded-full bg-red-500" />
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Hoa hồng tháng này</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{fmtVnd(mockKpi.commissionPending + mockKpi.commissionPaid)}</p>
          <p className="mt-2 text-sm text-emerald-600">▲ 27% so với tháng trước</p>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-amber-50 p-2">
            <p className="text-lg font-semibold text-amber-700">{mockKpi.ordersPending}</p>
            <p className="text-[10px] font-medium uppercase text-amber-700">Chờ duyệt</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2">
            <p className="text-lg font-semibold text-emerald-700">{mockKpi.ordersApproved}</p>
            <p className="text-[10px] font-medium uppercase text-emerald-700">Đã duyệt</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-2">
            <p className="text-lg font-semibold text-blue-700">{mockKpi.ordersPaid}</p>
            <p className="text-[10px] font-medium uppercase text-blue-700">Đã chi</p>
          </div>
        </div>
      </header>

      <section className="px-5 pt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Đơn gần đây</h2>
        <div className="space-y-3">
          {mockOrders.map((o) => (
            <article key={o.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusLabel[o.status].tone}`}>
                      {statusLabel[o.status].vi}
                    </span>
                    <span className="text-xs text-slate-400">{dayLabel(o.date)}</span>
                  </div>
                  <p className="mt-2 font-medium text-slate-900">{o.customer}</p>
                  <p className="text-xs text-slate-500">{o.model} · {o.serial}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{fmtShortVnd(o.price)}</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-600">+{fmtShortVnd(o.commission)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* FAB nhập đơn */}
      <button className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-2xl text-white shadow-lg shadow-blue-600/40 hover:bg-blue-700 active:scale-95 transition-transform">
        +
      </button>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white">
        <ul className="grid grid-cols-4 text-center">
          {[
            { icon: '🏠', label: 'Trang chủ', active: true },
            { icon: '📋', label: 'Đơn hàng' },
            { icon: '💰', label: 'Hoa hồng' },
            { icon: '👤', label: 'Tài khoản' },
          ].map((t) => (
            <li key={t.label} className={`flex flex-col items-center py-2 ${t.active ? 'text-blue-600' : 'text-slate-400'}`}>
              <span className="text-xl">{t.icon}</span>
              <span className="text-[10px] font-medium">{t.label}</span>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
