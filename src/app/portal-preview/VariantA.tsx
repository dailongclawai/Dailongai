'use client';
// PROTOTYPE — VariantA: Classic Analytics Dashboard

import { mockDealer, mockKpi, mockMonthlySeries, mockOrders, fmtVnd, fmtShortVnd, statusLabel } from './mock-data';

export const variantAName = 'Analytics Dashboard cổ điển';

export function VariantA() {
  const maxSales = Math.max(...mockMonthlySeries.map((m) => m.sales));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Chào {mockDealer.fullName}, đây là tổng quan tháng 5/2026</p>
        </div>
        <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700">
          + Nhập đơn mới
        </button>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Doanh số tháng', value: fmtVnd(mockKpi.monthSales), delta: '+44% MoM', deltaTone: 'text-emerald-600' },
          { label: 'Hoa hồng chờ duyệt', value: fmtVnd(mockKpi.commissionPending), delta: `${mockKpi.ordersPending} đơn pending`, deltaTone: 'text-amber-600' },
          { label: 'Hoa hồng đã chi', value: fmtVnd(mockKpi.commissionPaid), delta: 'Kỳ T05/2026', deltaTone: 'text-slate-500' },
          { label: 'Đã chốt', value: `${mockKpi.ordersPaid + mockKpi.ordersApproved} máy`, delta: `${mockKpi.ordersPaid} đã chi · ${mockKpi.ordersApproved} chờ chi`, deltaTone: 'text-slate-500' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{c.value}</p>
            <p className={`mt-1 text-xs ${c.deltaTone}`}>{c.delta}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-base font-semibold text-slate-900">Doanh số 6 tháng gần nhất</h2>
            <span className="text-xs text-slate-500">VND</span>
          </div>
          <div className="flex h-56 items-end gap-3">
            {mockMonthlySeries.map((m) => {
              const h = (m.sales / maxSales) * 100;
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-blue-500 to-blue-400 transition-all hover:from-blue-600 hover:to-blue-500"
                      style={{ height: `${h}%` }}
                      title={fmtVnd(m.sales)}
                    />
                  </div>
                  <p className="text-xs font-medium text-slate-600">{m.month}</p>
                  <p className="text-xs text-slate-400">{fmtShortVnd(m.sales)}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Hoạt động gần đây</h2>
          <ul className="space-y-3">
            {mockOrders.slice(0, 5).map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{o.customer}</p>
                  <p className="text-xs text-slate-500">{o.model} · {o.serial}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{fmtShortVnd(o.price)}</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusLabel[o.status].tone}`}>
                    {statusLabel[o.status].vi}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">Đơn hàng của tôi</h2>
          <a className="text-sm text-blue-600 hover:underline" href="#">Xem tất cả →</a>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-2 text-left">Serial</th>
              <th className="px-5 py-2 text-left">Khách hàng</th>
              <th className="px-5 py-2 text-left">Model</th>
              <th className="px-5 py-2 text-right">Giá bán</th>
              <th className="px-5 py-2 text-right">Hoa hồng</th>
              <th className="px-5 py-2 text-center">Trạng thái</th>
              <th className="px-5 py-2 text-left">Ngày</th>
            </tr>
          </thead>
          <tbody>
            {mockOrders.map((o) => (
              <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs">{o.serial}</td>
                <td className="px-5 py-3">{o.customer}</td>
                <td className="px-5 py-3">{o.model}</td>
                <td className="px-5 py-3 text-right">{fmtVnd(o.price)}</td>
                <td className="px-5 py-3 text-right font-medium text-emerald-700">{fmtVnd(o.commission)}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${statusLabel[o.status].tone}`}>
                    {statusLabel[o.status].vi}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-slate-500">{o.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
