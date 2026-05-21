'use client';
// PROTOTYPE — Admin Console (editorial infographic).
// Hero KPI · Fleet chart · Top dealers · Commission scheme TOGGLE · Payout schedule.

import { useState } from 'react';
import {
  mockFleet,
  mockTopDealers,
  mockMonthlyFleet,
  tierScheme,
  flatScheme,
  fmtShortVnd,
  fmtVnd,
} from '../mock-data';

const display = { fontFamily: 'var(--font-display), Georgia, serif' };
const numeric = { fontFamily: 'var(--font-numeric), monospace', fontFeatureSettings: '"tnum"' };

type Scheme = 'tier' | 'flat';

export default function AdminConsolePage() {
  const [scheme, setScheme] = useState<Scheme>('tier');
  const [editingId, setEditingId] = useState<string | null>(null);

  const max = Math.max(...mockMonthlyFleet.map((m) => m.revenue));
  const totalPayout = mockTopDealers.reduce((s, d) => {
    const rate = scheme === 'flat' ? flatScheme.rate / 100 : d.currentRate / 100;
    return s + d.monthSales * rate;
  }, 0);

  // Comparison helper — earnings at N units for each scheme
  const compareUnits = [50, 150, 250, 350];
  const priceAvg = 50_000_000;

  return (
    <div className="relative mx-auto max-w-[1240px] px-8 py-10">
      {/* ─── Editorial nav ─── */}
      <header className="flex items-baseline justify-between border-b border-[#0e1525]/15 pb-4">
        <div className="flex items-baseline gap-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#0e1525]/60">Đại Long Portal</p>
          <span className="h-1 w-1 rounded-full bg-[#c46a5e]" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#c46a5e]">Admin Console</p>
        </div>
        <nav className="flex items-center gap-8 text-[13px]">
          <a className="border-b-2 border-[#0e1525] pb-1 font-semibold">Tổng quan</a>
          <a className="text-[#0e1525]/60 hover:text-[#0e1525]">Đại lý</a>
          <a className="text-[#0e1525]/60 hover:text-[#0e1525]">Đơn hàng</a>
          <a className="text-[#0e1525]/60 hover:text-[#0e1525]">Hoa hồng</a>
          <a className="text-[#0e1525]/60 hover:text-[#0e1525]">Báo cáo</a>
          <a href="/portal-preview" className="text-[#0e1525]/60 hover:text-[#0e1525]">↩ Dealer view</a>
        </nav>
      </header>

      {/* ─── Hero: Issue / date ─── */}
      <div className="mt-8 flex items-baseline justify-between">
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
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                scheme === 'tier' ? 'bg-[#0e1525] text-[#f5f1e8]' : 'text-[#0e1525]/60'
              }`}
            >
              Tier A
            </button>
            <button
              onClick={() => setScheme('flat')}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                scheme === 'flat' ? 'bg-[#0e1525] text-[#f5f1e8]' : 'text-[#0e1525]/60'
              }`}
            >
              Flat B
            </button>
          </div>
        </div>
      </div>

      {/* ─── Hero KPI infographic ─── */}
      <section className="mt-12 grid grid-cols-12 gap-8">
        <div className="col-span-5">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#0e1525]/50">Tổng doanh thu YTD</p>
          <p style={{ ...display, fontVariationSettings: '"opsz" 144, "SOFT" 100' }} className="mt-2 text-[120px] font-light leading-[0.85] tracking-tighter">
            78<span className="text-[#c46a5e]">,</span>4
            <span style={numeric} className="ml-2 align-top text-3xl text-[#c46a5e]">tỷ ₫</span>
          </p>
          <p className="mt-3 text-sm text-[#0e1525]/60">
            <span style={numeric}>{mockFleet.unitsYtdAll.toLocaleString('vi-VN')}</span> máy đã chốt qua{' '}
            <span style={numeric}>{mockFleet.activeDealers}</span> đại lý hoạt động
          </p>
        </div>

        <div className="col-span-7 grid grid-cols-2 gap-3">
          {[
            {
              label: 'Đã bán T05',
              value: mockFleet.unitsThisMonth,
              unit: 'máy',
              tone: 'text-[#5d8d6a]',
              caption: '+18% MoM',
            },
            {
              label: 'Đơn chờ duyệt',
              value: mockFleet.pendingApprovals,
              unit: 'đơn',
              tone: 'text-[#c46a5e]',
              caption: 'cần action',
            },
            {
              label: 'Đăng ký mới',
              value: mockFleet.pendingRegistrations,
              unit: 'hồ sơ',
              tone: 'text-[#bc7e3b]',
              caption: 'chờ duyệt',
            },
            {
              label: 'Hoa hồng pending',
              value: fmtShortVnd(mockFleet.commissionPendingNow),
              unit: 'VND',
              tone: 'text-[#0e1525]',
              caption: `chi cho ${mockFleet.payoutDealersCount} dealer`,
            },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-[#0e1525]/10 bg-white/60 p-4 backdrop-blur">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#0e1525]/50">{k.label}</p>
              <p style={numeric} className={`mt-2 text-3xl font-medium ${k.tone}`}>
                {k.value}
              </p>
              <p className="text-xs text-[#0e1525]/50">{k.caption}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Fleet chart 12 months ─── */}
      <section className="mt-14 rounded-3xl border border-[#0e1525]/15 bg-white/50 p-8 backdrop-blur">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#c46a5e]">Doanh thu fleet 12 tháng</p>
            <h2 style={display} className="mt-1 text-2xl font-light italic">Đường cong tăng trưởng</h2>
          </div>
          <p className="text-xs text-[#0e1525]/60">Đơn vị: tỷ VND · highlight: T05/2026</p>
        </div>

        <div className="mt-8 flex h-56 items-end gap-2">
          {mockMonthlyFleet.map((m, i) => {
            const h = (m.revenue / max) * 100;
            const isLatest = i === mockMonthlyFleet.length - 1;
            return (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                <span style={numeric} className="text-[10px] font-medium text-[#0e1525]/60">
                  {(m.revenue / 1_000_000_000).toFixed(1)}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t ${
                      isLatest ? 'bg-gradient-to-t from-[#bc7e3b] to-[#d8a86a]' : 'bg-[#0e1525]/15'
                    } transition-all hover:opacity-80`}
                    style={{ height: `${h}%` }}
                    title={fmtVnd(m.revenue)}
                  />
                </div>
                <p className={`text-[10px] ${isLatest ? 'font-semibold text-[#bc7e3b]' : 'text-[#0e1525]/50'}`}>
                  {m.month.split('/')[0]}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Top dealers leaderboard + commission table ─── */}
      <section className="mt-14 grid grid-cols-12 gap-6">
        {/* Top dealers */}
        <div className="col-span-7 rounded-3xl border border-[#0e1525]/15 bg-white/60 p-6 backdrop-blur">
          <div className="mb-4 flex items-baseline justify-between border-b border-[#0e1525]/10 pb-3">
            <h2 style={display} className="text-2xl font-light italic">Top đại lý</h2>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#0e1525]/50">Set commission inline</p>
          </div>
          <div className="space-y-3">
            {mockTopDealers.map((d, i) => {
              const isEditing = editingId === d.id;
              const effRate = scheme === 'flat' ? flatScheme.rate : d.currentRate;
              return (
                <div key={d.id} className="grid grid-cols-12 items-center gap-3 rounded-xl px-3 py-3 hover:bg-[#0e1525]/5">
                  <div className="col-span-1">
                    <span style={numeric} className="text-xl text-[#0e1525]/30">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="col-span-3">
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-[#0e1525]/50">{d.city}</p>
                  </div>
                  <div className="col-span-3">
                    {/* mini progress */}
                    <div className="h-1 overflow-hidden rounded-full bg-[#0e1525]/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#bc7e3b] to-[#d8a86a]"
                        style={{ width: `${Math.min(100, (d.unitsYtd / 350) * 100)}%` }}
                      />
                    </div>
                    <p style={numeric} className="mt-1 text-[11px] text-[#0e1525]/60">
                      {d.unitsYtd}<span className="text-[#0e1525]/40">/350 máy</span>
                    </p>
                  </div>
                  <div className="col-span-2 text-right">
                    <p style={numeric} className="text-sm font-medium">{fmtShortVnd(d.monthSales)}</p>
                    <p className="text-[10px] text-[#0e1525]/50">T05</p>
                  </div>
                  <div className="col-span-2 text-center">
                    {isEditing && scheme === 'tier' ? (
                      <input
                        type="number"
                        defaultValue={d.currentRate}
                        className="w-16 rounded border border-[#bc7e3b] bg-white px-2 py-1 text-center text-sm"
                        style={numeric}
                        onBlur={() => setEditingId(null)}
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => scheme === 'tier' && setEditingId(d.id)}
                        className={`text-base font-medium ${
                          scheme === 'flat' ? 'cursor-not-allowed text-[#0e1525]/30' : 'text-[#bc7e3b] hover:underline'
                        }`}
                        style={numeric}
                        disabled={scheme === 'flat'}
                      >
                        {effRate}%
                      </button>
                    )}
                    <p className="text-[10px] text-[#0e1525]/50">Tier {d.tier}</p>
                  </div>
                  <div className="col-span-1 text-right">
                    <button className="text-[10px] text-[#0e1525]/40 hover:text-[#bc7e3b]" title="Chi tiết">···</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payout schedule + supervisor */}
        <div className="col-span-5 space-y-4">
          <div className="rounded-3xl border border-[#0e1525] bg-[#0e1525] p-6 text-[#f5f1e8]">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#c46a5e]">Đợt chi tiếp theo</p>
            <p style={display} className="mt-3 text-4xl font-light leading-none">
              05<span className="text-[#c46a5e]">–</span>10
              <span className="ml-2 text-lg text-[#f5f1e8]/60">/06/26</span>
            </p>
            <div className="mt-5 flex items-baseline gap-2">
              <span style={numeric} className="text-3xl font-medium">{fmtShortVnd(totalPayout)}</span>
              <span className="text-xs text-[#f5f1e8]/60">VND tổng dự kiến</span>
            </div>
            <p className="mt-1 text-[11px] text-[#f5f1e8]/60">
              cho <span style={numeric}>{mockFleet.payoutDealersCount}</span> đại lý + override supervisor
            </p>
            <div className="mt-5 flex gap-2">
              <button className="flex-1 rounded-full bg-[#c46a5e] py-2 text-xs font-medium hover:bg-[#d97d70]">
                Chạy thử calc
              </button>
              <button className="flex-1 rounded-full border border-[#f5f1e8]/30 py-2 text-xs font-medium hover:bg-[#f5f1e8]/10">
                Lịch sử đợt
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-[#0e1525]/15 bg-white/60 p-6 backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#0e1525]/50">Override Supervisor</p>
            <p className="mt-3 text-sm">
              <span style={numeric} className="text-2xl font-medium">2.5%</span>{' '}
              <span className="text-[#0e1525]/60">trên doanh số dealer dưới quyền</span>
            </p>
            <button className="mt-3 text-xs text-[#bc7e3b] hover:underline">Sửa override →</button>
          </div>
        </div>
      </section>

      {/* ─── Commission Scheme Comparison Infographic ─── */}
      <section className="mt-14 rounded-3xl border-2 border-[#0e1525] bg-white p-8">
        <div className="mb-6 flex items-baseline justify-between border-b border-[#0e1525]/15 pb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#c46a5e]">Quyết định cần Boss chốt</p>
            <h2 style={display} className="mt-1 text-3xl font-light italic">Tier (A) hay Flat (B)?</h2>
          </div>
          <p className="text-xs text-[#0e1525]/60">Số liệu = giá trung bình <span style={numeric}>{fmtShortVnd(priceAvg)}</span>/máy</p>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Tier A */}
          <div className={`rounded-2xl border-2 p-6 ${scheme === 'tier' ? 'border-[#bc7e3b] bg-[#bc7e3b]/5' : 'border-[#0e1525]/15'}`}>
            <div className="mb-4 flex items-baseline justify-between">
              <h3 style={display} className="text-xl">Phương án A · Tier</h3>
              {scheme === 'tier' && (
                <span className="rounded-full bg-[#bc7e3b] px-2 py-0.5 text-[10px] font-medium uppercase text-white">Đang chạy</span>
              )}
            </div>

            {/* visual ladder */}
            <div className="my-6">
              <div className="relative h-2 rounded-full bg-[#0e1525]/10">
                {tierScheme.tiers.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    className="absolute -translate-x-1/2"
                    style={{ left: `${(t.minUnits / 300) * 100}%`, top: '-7px' }}
                  >
                    <div className="h-4 w-4 rounded-full border-2 border-[#bc7e3b] bg-[#f5f1e8]" />
                  </div>
                ))}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#bc7e3b]/0 via-[#bc7e3b]/60 to-[#bc7e3b]" />
              </div>
              <div className="mt-6 grid grid-cols-4 text-center">
                {tierScheme.tiers.slice(0, 4).map((t) => (
                  <div key={t.id}>
                    <p style={numeric} className="text-xs text-[#0e1525]/60">{t.minUnits}+</p>
                    <p style={display} className="text-2xl text-[#bc7e3b]">{t.percent}%</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs leading-relaxed text-[#0e1525]/70">
              Hoa hồng tăng dần theo số máy bán trong năm. Đại lý có động lực push doanh số. Admin chỉ chỉnh tier threshold + override exception.
            </p>

            {/* Earnings example */}
            <div className="mt-5 space-y-1.5 rounded-xl bg-[#f5f1e8] p-4 text-xs">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-[#0e1525]/50">Ví dụ thu nhập đại lý YTD</p>
              {compareUnits.map((u) => {
                const tier = tierScheme.tiers.slice().reverse().find((t) => u >= t.minUnits)!;
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

          {/* Flat B */}
          <div className={`rounded-2xl border-2 p-6 ${scheme === 'flat' ? 'border-[#bc7e3b] bg-[#bc7e3b]/5' : 'border-[#0e1525]/15'}`}>
            <div className="mb-4 flex items-baseline justify-between">
              <h3 style={display} className="text-xl">Phương án B · Flat</h3>
              {scheme === 'flat' && (
                <span className="rounded-full bg-[#bc7e3b] px-2 py-0.5 text-[10px] font-medium uppercase text-white">Đang chạy</span>
              )}
            </div>

            {/* visual flat bar */}
            <div className="my-6">
              <div className="relative h-2 rounded-full bg-gradient-to-r from-[#5d8d6a] to-[#5d8d6a]" />
              <div className="mt-6 text-center">
                <p style={display} className="text-6xl text-[#5d8d6a]">{flatScheme.rate}%</p>
                <p className="text-[10px] uppercase tracking-wider text-[#0e1525]/50">mọi đơn · mọi đại lý</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-[#0e1525]/70">
              Khoá cứng <span style={numeric} className="font-medium">20%</span> mọi máy. Đơn giản, dễ giải thích, dễ predict cash-flow. Không khuyến khích push thêm khi đã đạt break-even.
            </p>

            {/* Earnings example */}
            <div className="mt-5 space-y-1.5 rounded-xl bg-[#f5f1e8] p-4 text-xs">
              <p className="mb-2 text-[10px] uppercase tracking-wider text-[#0e1525]/50">Ví dụ thu nhập đại lý YTD</p>
              {compareUnits.map((u) => {
                const earn = u * priceAvg * (flatScheme.rate / 100);
                return (
                  <div key={u} className="flex justify-between">
                    <span style={numeric}>{u} máy</span>
                    <span>
                      <span className="text-[#5d8d6a]">@{flatScheme.rate}%</span>{' '}
                      <span style={numeric} className="ml-2 font-medium">{fmtShortVnd(earn)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recommendation */}
        <div className="mt-6 grid grid-cols-2 gap-8 text-xs">
          <div className="border-t border-[#0e1525]/15 pt-3">
            <p className="font-semibold text-[#0e1525]">Khi nào chọn Tier (A)?</p>
            <ul className="mt-2 space-y-1 text-[#0e1525]/70">
              <li>• Muốn dealer push hết sức để lên tier cao hơn</li>
              <li>• Có dealer top performer cần thưởng khác biệt</li>
              <li>• Chấp nhận admin overhead set tier exception</li>
            </ul>
          </div>
          <div className="border-t border-[#0e1525]/15 pt-3">
            <p className="font-semibold text-[#0e1525]">Khi nào chọn Flat (B)?</p>
            <ul className="mt-2 space-y-1 text-[#0e1525]/70">
              <li>• Mới ra mắt portal, ưu tiên đơn giản</li>
              <li>• Tránh tranh cãi giữa các dealer về tier</li>
              <li>• Predict cash-flow dễ, P&L stable</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ─── Auto-payment policy ─── */}
      <section className="mt-14 rounded-3xl border border-[#0e1525]/15 bg-white/60 p-8 backdrop-blur">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#bc7e3b]">Chính sách chi trả</p>
            <h2 style={display} className="mt-1 text-3xl font-light italic">Tự động · ngày 5–10</h2>
          </div>
          <div className="col-span-8 grid grid-cols-3 gap-4">
            {[
              {
                step: '01',
                label: 'Khoá kỳ',
                detail: 'Mọi đơn approved trước 23:59 ngày 30/T sẽ được tính vào đợt chi.',
              },
              {
                step: '02',
                label: 'Tính + duyệt',
                detail: 'Ngày 1–4: Postgres trigger tính commission_payouts, admin sanity check.',
              },
              {
                step: '03',
                label: 'Chi tự động',
                detail: 'Ngày 5–10: bank batch transfer + Zalo OA notify dealer + supervisor.',
              },
            ].map((s) => (
              <div key={s.step} className="rounded-xl border border-[#0e1525]/10 bg-[#f5f1e8] p-4">
                <p style={numeric} className="text-3xl font-light text-[#bc7e3b]">{s.step}</p>
                <p className="mt-2 text-sm font-semibold">{s.label}</p>
                <p className="mt-1 text-xs text-[#0e1525]/60">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mt-20 flex items-center justify-between border-t border-[#0e1525]/15 pt-6 text-[11px] text-[#0e1525]/50">
        <p>© Đại Long — công nghệ chăm sóc sức khoẻ · Admin Console</p>
        <a href="/portal-preview" className="hover:text-[#bc7e3b]">← Quay lại dealer view</a>
      </footer>
    </div>
  );
}
