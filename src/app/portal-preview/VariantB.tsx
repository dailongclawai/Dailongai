'use client';
// PROTOTYPE — VariantB: Action-First Working Pad (Kanban + big CTA)

import { mockDealer, mockKpi, mockOrders, fmtVnd, fmtShortVnd, statusLabel, type OrderStatus } from './mock-data';

export const variantBName = 'Action-first Working Pad';

const columns: Array<{ status: OrderStatus; title: string; accent: string }> = [
  { status: 'pending', title: 'Đang chờ duyệt', accent: 'border-amber-300 bg-amber-50' },
  { status: 'approved', title: 'Đã duyệt - chờ chi', accent: 'border-emerald-300 bg-emerald-50' },
  { status: 'paid', title: 'Đã chi hoa hồng', accent: 'border-blue-300 bg-blue-50' },
];

export function VariantB() {
  const targetPct = Math.min(100, (mockKpi.monthSales / mockKpi.monthTarget) * 100);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white shadow-xl">
        <div className="grid grid-cols-1 gap-6 p-8 lg:grid-cols-[2fr_3fr]">
          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-wide text-blue-200">Xin chào {mockDealer.fullName.split(' ').slice(-1)[0]}</p>
            <h1 className="text-3xl font-bold leading-tight">Có 1 phút? Ghi nhận đơn vừa chốt.</h1>
            <p className="text-sm text-blue-100/80">Càng nhập sớm, hoa hồng càng được duyệt nhanh.</p>
            <button className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-blue-900 shadow-lg shadow-blue-900/30 hover:bg-blue-50">
              + Nhập đơn bán máy
            </button>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
              <div className="mb-2 flex items-center justify-between text-xs text-blue-100">
                <span>Mục tiêu tháng 05/2026</span>
                <span className="font-medium text-white">{targetPct.toFixed(0)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-300" style={{ width: `${targetPct}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-blue-100/80">
                <span>{fmtShortVnd(mockKpi.monthSales)}</span>
                <span>/ {fmtShortVnd(mockKpi.monthTarget)}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
                <p className="text-xs text-blue-100/80">Hoa hồng pending</p>
                <p className="mt-1 text-lg font-semibold">{fmtShortVnd(mockKpi.commissionPending)}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
                <p className="text-xs text-blue-100/80">Đã chi tháng này</p>
                <p className="mt-1 text-lg font-semibold">{fmtShortVnd(mockKpi.commissionPaid)}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
                <p className="text-xs text-blue-100/80">Đơn chốt</p>
                <p className="mt-1 text-lg font-semibold">{mockKpi.ordersPaid + mockKpi.ordersApproved}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Bảng làm việc</h2>
          <p className="text-sm text-slate-500">Kéo đơn hoặc click để xem chi tiết</p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {columns.map((col) => {
            const items = mockOrders.filter((o) => o.status === col.status);
            const total = items.reduce((s, o) => s + o.commission, 0);
            return (
              <div key={col.status} className={`rounded-2xl border-2 ${col.accent} p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{col.title}</h3>
                    <p className="text-xs text-slate-600">{items.length} đơn · {fmtShortVnd(total)} hoa hồng</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-sm">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((o) => (
                    <div key={o.id} className="rounded-lg border border-white/80 bg-white p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{o.customer}</p>
                          <p className="text-xs text-slate-500">{o.model}</p>
                        </div>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{o.serial.slice(-4)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-slate-500">{o.date.slice(5)}</span>
                        <span className="font-semibold text-emerald-700">+{fmtShortVnd(o.commission)}</span>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-lg border-2 border-dashed border-white/60 p-6 text-center text-xs text-slate-400">
                      Trống
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
