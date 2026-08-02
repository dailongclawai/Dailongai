'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Space_Grotesk } from 'next/font/google';
import {
  currentMonthVn, getAdminFleet, getCrmAccounts, getCrmActivities, getCrmFeedbacks,
  getCrmKpiDeviceMonths, getCrmKpiNewAccountsDays, getCrmStaffReport, getStaffPeers,
} from '@/lib/portal-queries';
import type {
  CrmAccountListRow, CrmKpiDeviceMonth, CrmKpiNewAccountsDay, CrmStaffReportRow, FleetSummary,
} from '@/lib/portal-types';
import { kpiStatus } from '@/lib/crm-kpi';
import { useI18n } from '@/lib/i18n';

// Chữ hiển thị của phòng điều hành: Space Grotesk — theo design system
// "Đại Long Command Center", có subset tiếng Việt. Thân chữ vẫn theo font portal.
const display = Space_Grotesk({ subsets: ['vietnamese', 'latin'], weight: ['500', '700'] });

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

/** Hôm nay theo giờ Việt Nam, dạng yyyy-mm-dd — khớp cột ngay của view KPI. */
function todayVn(): string {
  const vn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return `${vn.getFullYear()}-${String(vn.getMonth() + 1).padStart(2, '0')}-${String(vn.getDate()).padStart(2, '0')}`;
}

/** Hai chữ cái đầu làm avatar chữ — lấy chữ đầu của hai từ cuối trong tên. */
function initials(name: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const picked = words.slice(-2);
  return picked.map(w => w[0]!.toUpperCase()).join('');
}

const rise = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] as const },
});

// Màu huy hiệu hạng 1-2-3: vàng — bạc — đồng (theo design Stitch "Phòng Điều Hành").
const RANK_COLORS = ['#fbbf24', '#c6c6ca', '#ffb77d'];
// Chấm trạng thái KPI: chậm — đạt — xuất sắc.
const STATUS_DOT = { missed: '#f87171', met: '#34d399', excellent: '#ffb77d' } as const;

// Boss chốt 02/08/2026: Tổng quan admin đo mô hình nhân viên bán qua CRM.
// Bố cục "phòng điều hành" theo design Stitch screen-4: hero numeral máy bán/chỉ tiêu
// → hàng 4 command stat → leaderboard nhân viên + rail "Cần xử lý" + donut tỷ trọng khách.
export function AdminConsole() {
  const { t } = useI18n();
  const [fleet, setFleet] = useState<FleetSummary | null>(null);
  const [kpiRows, setKpiRows] = useState<CrmKpiDeviceMonth[]>([]);
  const [accounts, setAccounts] = useState<CrmAccountListRow[]>([]);
  const [staffReport, setStaffReport] = useState<CrmStaffReportRow[]>([]);
  const [newDays, setNewDays] = useState<CrmKpiNewAccountsDay[]>([]);
  const [unreadFeedback, setUnreadFeedback] = useState(0);
  const [overdueTasks, setOverdueTasks] = useState(0);
  const [staffCount, setStaffCount] = useState(0);

  // Mỗi nguồn tự rơi về 0/rỗng khi lỗi — một API hỏng không được kéo sập cả trang.
  useEffect(() => {
    void getAdminFleet().then(setFleet).catch(() => setFleet(null));
    void getCrmKpiDeviceMonths().then(setKpiRows).catch(() => undefined);
    void getCrmAccounts().then(setAccounts).catch(() => undefined);
    void getCrmStaffReport().then(setStaffReport).catch(() => undefined);
    void getCrmKpiNewAccountsDays().then(setNewDays).catch(() => undefined);
    void getCrmFeedbacks().then(fs => setUnreadFeedback(fs.filter(f => !f.read_at).length)).catch(() => undefined);
    void getCrmActivities()
      .then(as => setOverdueTasks(as.filter(a => !a.done_at && a.due_at && new Date(a.due_at) < new Date()).length))
      .catch(() => undefined);
    void getStaffPeers().then(ps => setStaffCount(ps.filter(p => p.role === 'staff').length)).catch(() => undefined);
  }, []);

  const f = fleet ?? { active_dealers: 0, units_ytd: 0, units_month: 0, orders_pending: 0, revenue_ytd: 0, commission_pending: 0 };

  // ── Suy ra từ các mảng đã fetch — không thêm query mới ──
  const cm = currentMonthVn();
  const monthRows = kpiRows.filter(r => r.thang === cm);
  const devMonth = monthRows.reduce((a, r) => a + r.devices_won, 0);
  const devTarget = monthRows.reduce((a, r) => a + r.kpi_target, 0);
  const heroPct = devTarget > 0 ? Math.min(100, (devMonth / devTarget) * 100) : 0;

  const pendingConfirm = accounts.filter(r => r.won_requested_at && !r.stage_locked).length;
  const pipelineOpen = accounts.reduce((a, r) => a + r.open_deals, 0);
  const staffCommission = staffReport.reduce((a, r) => a + Number(r.amount_pending) + Number(r.amount_payable), 0);

  const today = todayVn();
  const newToday = newDays.filter(d => d.ngay === today).reduce((a, d) => a + d.retail_new + d.org_new, 0);
  // Khách mới 14 ngày theo từng nhân viên — view chỉ phủ 14 ngày gần nhất.
  const new14ByStaff = new Map<string, number>();
  for (const d of newDays) new14ByStaff.set(d.staff_id, (new14ByStaff.get(d.staff_id) ?? 0) + d.retail_new + d.org_new);
  const commissionByStaff = new Map(staffReport.map(r => [r.staff_id, Number(r.commission_total)]));

  const leaderboard = [...monthRows].sort(
    (a, b) => b.devices_won - a.devices_won || Number(b.won_value) - Number(a.won_value),
  );

  // Tỷ trọng Khách lẻ / Khách tổ chức trên toàn sổ khách hàng.
  const retailCount = accounts.filter(r => r.is_individual).length;
  const orgCount = accounts.length - retailCount;
  const retailPct = accounts.length > 0 ? (retailCount / accounts.length) * 100 : 0;

  // Hàng 4 command stat — nhịp số của cỗ máy bán hàng.
  const stats = [
    { label: t('portal.components.adminConsole.revenue_ytd'), value: `${fmtVnd(f.revenue_ytd)}₫`, color: '#8bd6b6' },
    { label: t('portal.crm.pipeline.open_count'), value: String(pipelineOpen), color: '#e2e2e6' },
    { label: t('portal.components.adminConsole.kpi_staff_commission'), value: `${fmtVnd(staffCommission)}₫`, color: '#ffb77d' },
    { label: t('portal.components.adminConsole.kpi_unread_feedback'), value: String(unreadFeedback), color: unreadFeedback > 0 ? '#f87171' : '#e2e2e6' },
  ];

  // Rail phải: việc đang chờ tay admin — cả hàng là nút bấm, badge đếm gold.
  const actions = [
    { label: t('portal.components.adminConsole.kpi_pending_confirm'), value: pendingConfirm, icon: 'fact_check', color: '#fbbf24', href: '/portal/crm/accounts' },
    { label: t('portal.components.adminConsole.kpi_orders_pending'), value: f.orders_pending, icon: 'pending_actions', color: '#8bd6b6', href: '/portal/admin/orders' },
    { label: t('portal.components.adminConsole.kpi_unread_feedback'), value: unreadFeedback, icon: 'mark_email_unread', color: '#ffb77d', href: '/portal/crm/feedback' },
    { label: t('portal.components.adminConsole.action_overdue'), value: overdueTasks, icon: 'event_busy', color: '#f87171', href: '/portal/crm/activities' },
  ];

  const corner = (
    <>
      {/* Ngạnh góc kiểu bảng đồng hồ công nghiệp */}
      <span className="pointer-events-none absolute left-2 top-2 h-2 w-2 border-l border-t border-[#e2e2e6]/15" />
      <span className="pointer-events-none absolute bottom-2 right-2 h-2 w-2 border-b border-r border-[#e2e2e6]/15" />
    </>
  );

  const card = 'relative overflow-hidden rounded-xl border border-[#3f4944]/50 bg-[#1a1c1f]/90';

  // Donut SVG thuần: 2 cung — Khách lẻ emerald, Khách tổ chức gold.
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative space-y-8 py-4">
      {/* Khí quyển: lưới bản vẽ + quầng than hồng, nằm sau toàn bộ nội dung */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -top-8 bottom-0 -z-10 bg-[linear-gradient(rgba(226,226,230,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(226,226,230,0.025)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_75%_60%_at_35%_0%,black,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 -z-10 h-[420px] w-[560px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(6,95,70,0.24),transparent_62%)]"
      />

      {/* HERO — kicker + trạng thái hệ thống + numeral máy bán toàn công ty / chỉ tiêu */}
      <motion.section {...rise(0)} className="relative">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34d399] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34d399]" />
          </span>
          <p className="text-[11px] uppercase tracking-widest text-[#a8b3ac]">
            {t('portal.components.adminConsole.hero_status')}
          </p>
        </div>
        <h1 className={`${display.className} mt-4 text-sm font-medium uppercase tracking-[0.35em] text-[#8bd6b6]`}>
          {t('portal.components.adminConsole.hero_kicker')}
        </h1>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className={`${display.className} text-[64px] font-bold leading-none tracking-tight tabular-nums md:text-[84px]`}>
            {devMonth}
          </span>
          <span className="text-base text-[#a8b3ac]">
            {devTarget > 0 && <span className={`${display.className} tabular-nums`}>/ {devTarget} </span>}
            {t('portal.components.adminConsole.hero_units_label')}
          </span>
        </div>
        {/* Progress bar mảnh dưới numeral */}
        <div className="mt-4 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-[#1e2023]">
          <div
            className="h-full rounded-full bg-[#8bd6b6] shadow-[0_0_8px_rgba(139,214,182,0.6)] transition-[width] duration-700"
            style={{ width: `${heroPct}%` }}
          />
        </div>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#e2e2e6]/60">
          <span><b className={`${display.className} tabular-nums text-[#e2e2e6]`}>{f.units_ytd}</b> {t('portal.components.adminConsole.sub_orders_ytd')}</span>
          <span><b className={`${display.className} tabular-nums text-[#e2e2e6]`}>{staffCount}</b> {t('portal.components.adminConsole.sub_staff')}</span>
          <span><b className={`${display.className} tabular-nums text-[#e2e2e6]`}>{newToday}</b> {t('portal.components.adminConsole.sub_new_today')}</span>
        </p>
      </motion.section>

      {/* HÀNG 4 COMMAND STAT */}
      <section>
        <motion.p {...rise(1)} className={`${display.className} mb-3 text-[11px] uppercase tracking-[0.35em] text-[#e2e2e6]/45`}>
          {t('portal.components.adminConsole.group_pulse')}
        </motion.p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div key={s.label} {...rise(2 + i)} className={`${card} flex flex-col justify-between p-5 transition-colors hover:bg-[#1e2023]`}>
              {corner}
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#e2e2e6]/50">{s.label}</p>
              <p className={`${display.className} mt-4 text-2xl font-bold tabular-nums`} style={{ color: s.color }}>
                {s.value}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* LEADERBOARD + RAIL PHẢI */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Hiệu suất nhân viên */}
        <motion.section {...rise(6)} className={`${card} lg:col-span-2`}>
          {corner}
          <div className="flex items-center justify-between border-b border-[#3f4944]/50 p-5">
            <h3 className={`${display.className} flex items-center gap-2 text-lg font-medium text-[#e2e2e6]`}>
              <span className="material-symbols-outlined text-[18px] text-[#8bd6b6]">leaderboard</span>
              {t('portal.components.adminConsole.leaderboard_title')}
            </h3>
            <Link
              href="/portal/crm/kpi"
              className="rounded border border-[#8bd6b6]/20 px-3 py-1 text-[11px] uppercase tracking-widest text-[#8bd6b6] transition-colors hover:border-[#8bd6b6]/50"
            >
              {t('portal.crm.dash.view_all')}
            </Link>
          </div>
          {leaderboard.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#a8b3ac]">
              {t('portal.components.adminConsole.leaderboard_empty')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e2e2e6]/5">
                    <th className="w-12 p-4 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-[#e2e2e6]/50">
                      {t('portal.components.adminConsole.col_rank')}
                    </th>
                    <th className="p-4 text-[11px] font-medium uppercase tracking-[0.18em] text-[#e2e2e6]/50">
                      {t('portal.crm.kpi.col_staff')}
                    </th>
                    <th className="min-w-[150px] p-4 text-[11px] font-medium uppercase tracking-[0.18em] text-[#e2e2e6]/50">
                      {t('portal.components.adminConsole.col_devices_sold')}
                    </th>
                    <th className="p-4 text-right text-[11px] font-medium uppercase tracking-[0.18em] text-[#e2e2e6]/50">
                      {t('portal.components.adminConsole.col_new14')}
                    </th>
                    <th className="p-4 text-right text-[11px] font-medium uppercase tracking-[0.18em] text-[#e2e2e6]/50">
                      {t('portal.components.adminConsole.col_commission_est')}
                    </th>
                    <th className="p-4 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-[#e2e2e6]/50">
                      {t('portal.crm.kpi.col_status')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e2e6]/5">
                  {leaderboard.map((r, i) => {
                    const status = kpiStatus(r.devices_won, r.tenure_month);
                    const statusLabel = t(`portal.crm.kpi.status_${status === 'excellent' ? 'excellent' : status === 'met' ? 'met' : 'missed'}`);
                    const rankColor = RANK_COLORS[i];
                    const pct = r.kpi_target > 0 ? Math.min(100, (r.devices_won / r.kpi_target) * 100) : 0;
                    return (
                      <tr key={r.staff_id} className="group transition-colors hover:bg-[#e2e2e6]/[0.02]">
                        <td className="p-4 text-center">
                          {rankColor ? (
                            <span
                              className={`${display.className} mx-auto flex h-6 w-6 items-center justify-center rounded border text-xs font-bold tabular-nums`}
                              style={{
                                color: rankColor, borderColor: `${rankColor}80`, backgroundColor: `${rankColor}1f`,
                                boxShadow: i === 0 ? '0 0 8px rgba(217,119,6,0.35)' : undefined,
                              }}
                            >
                              {i + 1}
                            </span>
                          ) : (
                            <span className={`${display.className} text-xs tabular-nums text-[#a8b3ac]`}>{i + 1}</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <span className={`${display.className} flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1e2023] text-xs font-bold text-[#a8b3ac]`}>
                              {initials(r.full_name)}
                            </span>
                            <span className="whitespace-nowrap font-medium text-[#e2e2e6] transition-colors group-hover:text-[#8bd6b6]">
                              {r.full_name ?? '—'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#1e2023]">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${pct}%`, backgroundColor: status === 'missed' ? '#3f4944' : '#8bd6b6' }}
                              />
                            </div>
                            <span className={`${display.className} w-10 text-xs tabular-nums text-[#a8b3ac]`}>
                              {r.devices_won}/{r.kpi_target}
                            </span>
                          </div>
                        </td>
                        <td className={`${display.className} p-4 text-right tabular-nums text-[#e2e2e6]`}>
                          {new14ByStaff.get(r.staff_id) ?? 0}
                        </td>
                        <td className={`${display.className} whitespace-nowrap p-4 text-right tabular-nums text-[#8bd6b6]`}>
                          {fmtVnd(commissionByStaff.get(r.staff_id) ?? 0)}₫
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className="mx-auto inline-block h-1.5 w-1.5 rounded-full"
                            title={statusLabel}
                            style={{ backgroundColor: STATUS_DOT[status], boxShadow: `0 0 5px ${STATUS_DOT[status]}` }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>

        {/* Rail phải: Cần xử lý + donut tỷ trọng khách */}
        <aside className="flex flex-col gap-4">
          <motion.div {...rise(7)} className={card}>
            {corner}
            <div className="border-b border-[#3f4944]/50 p-4">
              <h3 className={`${display.className} flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.35em] text-[#ffb77d]`}>
                <span className="material-symbols-outlined text-[14px]">bolt</span>
                {t('portal.components.adminConsole.group_action')}
              </h3>
            </div>
            <div className="flex flex-col gap-1 p-2">
              {actions.map(a => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="group flex w-full items-center justify-between rounded-lg border border-transparent p-3 text-left transition-colors hover:border-[#e2e2e6]/5 hover:bg-[#e2e2e6]/5"
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="material-symbols-outlined flex h-8 w-8 items-center justify-center rounded-full text-[16px]"
                      style={{ color: a.color, backgroundColor: `${a.color}1a` }}
                    >
                      {a.icon}
                    </span>
                    <span className="text-sm text-[#e2e2e6] transition-colors group-hover:text-[#8bd6b6]">{a.label}</span>
                  </span>
                  <span
                    className={`${display.className} rounded px-2 py-0.5 text-sm font-bold tabular-nums`}
                    style={a.value > 0
                      ? { color: '#ffb77d', backgroundColor: '#ffb77d1a' }
                      : { color: '#a8b3ac', backgroundColor: '#3f49444d' }}
                  >
                    {a.value}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>

          <motion.div {...rise(8)} className={`${card} flex flex-1 flex-col p-5`}>
            {corner}
            <h3 className={`${display.className} mb-6 text-[11px] font-medium uppercase tracking-[0.35em] text-[#e2e2e6]/45`}>
              {t('portal.components.adminConsole.donut_title')}
            </h3>
            {accounts.length === 0 ? (
              <p className="flex-1 content-center text-center text-sm text-[#a8b3ac]">
                {t('portal.components.adminConsole.donut_empty')}
              </p>
            ) : (
              <>
                <div className="relative flex min-h-[150px] flex-1 items-center justify-center">
                  <svg width="130" height="130" viewBox="0 0 130 130" role="img" aria-label={t('portal.components.adminConsole.donut_title')}>
                    {/* Cung Khách tổ chức: vòng nền gold; cung Khách lẻ đè lên bằng emerald */}
                    <circle cx="65" cy="65" r={R} fill="none" stroke="#d97706" strokeWidth="12" opacity="0.85" />
                    <circle
                      cx="65" cy="65" r={R} fill="none" stroke="#8bd6b6" strokeWidth="12" strokeLinecap="butt"
                      strokeDasharray={`${(retailPct / 100) * C} ${C}`}
                      transform="rotate(-90 65 65)"
                    />
                    <text
                      x="65" y="65" textAnchor="middle" dominantBaseline="central"
                      className={`${display.className} tabular-nums`} fill="#8bd6b6" fontSize="20" fontWeight="700"
                    >
                      {Math.round(retailPct)}%
                    </text>
                  </svg>
                </div>
                <div className="mt-4 flex justify-center gap-6">
                  <span className="flex items-center gap-2 text-xs text-[#a8b3ac]">
                    <span className="h-2 w-2 rounded-full bg-[#8bd6b6] shadow-[0_0_5px_#8bd6b6]" />
                    {t('portal.crm.segment.b2c')} (<b className={`${display.className} tabular-nums`}>{retailCount}</b>)
                  </span>
                  <span className="flex items-center gap-2 text-xs text-[#a8b3ac]">
                    <span className="h-2 w-2 rounded-full bg-[#d97706] shadow-[0_0_5px_#d97706]" />
                    {t('portal.crm.segment.b2b')} (<b className={`${display.className} tabular-nums`}>{orgCount}</b>)
                  </span>
                </div>
              </>
            )}
          </motion.div>
        </aside>
      </div>
    </div>
  );
}
