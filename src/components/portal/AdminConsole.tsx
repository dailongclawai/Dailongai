'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Space_Grotesk } from 'next/font/google';
import {
  currentMonthVn, getAdminFleet, getCrmAccounts, getCrmActivities, getCrmFeedbacks,
  getCrmKpiDeviceMonths, getCrmKpiNewAccountsDays, getCrmStaffReport, getStaffPeers,
} from '@/lib/portal-queries';
import type { FleetSummary } from '@/lib/portal-types';
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

const rise = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] as const },
});

// Boss chốt 02/08/2026: Tổng quan admin đo mô hình nhân viên bán qua CRM.
// Bố cục "phòng điều hành": hàng CẦN XỬ LÝ HÔM NAY đứng trên NHỊP KINH DOANH.
export function AdminConsole() {
  const { t } = useI18n();
  const [fleet, setFleet] = useState<FleetSummary | null>(null);
  const [devMonth, setDevMonth] = useState(0);
  const [pendingConfirm, setPendingConfirm] = useState(0);
  const [staffCommission, setStaffCommission] = useState(0);
  const [newToday, setNewToday] = useState(0);
  const [unreadFeedback, setUnreadFeedback] = useState(0);
  const [overdueTasks, setOverdueTasks] = useState(0);
  const [staffCount, setStaffCount] = useState(0);

  // Mỗi nguồn tự rơi về 0 khi lỗi — một API hỏng không được kéo sập cả trang.
  useEffect(() => {
    void getAdminFleet().then(setFleet).catch(() => setFleet(null));
    void getCrmKpiDeviceMonths().then(rows => {
      const cm = currentMonthVn();
      setDevMonth(rows.filter(r => r.thang === cm).reduce((a, r) => a + r.devices_won, 0));
    }).catch(() => undefined);
    void getCrmAccounts()
      .then(rs => setPendingConfirm(rs.filter(r => r.won_requested_at && !r.stage_locked).length))
      .catch(() => undefined);
    void getCrmStaffReport()
      .then(rs => setStaffCommission(rs.reduce((a, r) => a + Number(r.amount_pending) + Number(r.amount_payable), 0)))
      .catch(() => undefined);
    void getCrmKpiNewAccountsDays().then(ds => {
      const today = todayVn();
      setNewToday(ds.filter(d => d.ngay === today).reduce((a, d) => a + d.retail_new + d.org_new, 0));
    }).catch(() => undefined);
    void getCrmFeedbacks().then(fs => setUnreadFeedback(fs.filter(f => !f.read_at).length)).catch(() => undefined);
    void getCrmActivities()
      .then(as => setOverdueTasks(as.filter(a => !a.done_at && a.due_at && new Date(a.due_at) < new Date()).length))
      .catch(() => undefined);
    void getStaffPeers().then(ps => setStaffCount(ps.filter(p => p.role === 'staff').length)).catch(() => undefined);
  }, []);

  const f = fleet ?? { active_dealers: 0, units_ytd: 0, units_month: 0, orders_pending: 0, revenue_ytd: 0, commission_pending: 0 };

  // Hàng trên: việc đang chờ tay admin — cả thẻ là nút bấm.
  const actions = [
    { label: t('portal.components.adminConsole.kpi_pending_confirm'), value: pendingConfirm, icon: 'hourglass_top', color: '#fbbf24', href: '/portal/crm/accounts' },
    { label: t('portal.components.adminConsole.kpi_orders_pending'), value: f.orders_pending, icon: 'pending_actions', color: '#8bd6b6', href: '/portal/admin/orders' },
    { label: t('portal.components.adminConsole.kpi_unread_feedback'), value: unreadFeedback, icon: 'mark_email_unread', color: '#ffb77d', href: '/portal/crm/feedback' },
  ];
  // Hàng dưới: nhịp số của cỗ máy bán hàng.
  const pulse = [
    { label: t('portal.components.adminConsole.kpi_units_month'), value: String(devMonth), icon: 'sell', color: '#34d399' },
    { label: t('portal.components.adminConsole.kpi_new_today'), value: String(newToday), icon: 'person_add', color: '#ffb77d' },
    { label: t('portal.components.adminConsole.kpi_staff_commission'), value: fmtVnd(staffCommission), icon: 'payments', color: '#3b82f6', href: '/portal/crm/commission' },
  ];

  const corner = (
    <>
      {/* Ngạnh góc kiểu bảng đồng hồ công nghiệp */}
      <span className="pointer-events-none absolute left-2 top-2 h-2 w-2 border-l border-t border-[#e2e2e6]/15" />
      <span className="pointer-events-none absolute bottom-2 right-2 h-2 w-2 border-b border-r border-[#e2e2e6]/15" />
    </>
  );

  return (
    <div className="relative space-y-10 py-4">
      {/* Khí quyển: lưới bản vẽ + quầng than hồng, nằm sau toàn bộ nội dung */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -top-8 bottom-0 -z-10 bg-[linear-gradient(rgba(226,226,230,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(226,226,230,0.025)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_75%_60%_at_35%_0%,black,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 -z-10 h-[420px] w-[560px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(6,95,70,0.24),transparent_62%)]"
      />

      <motion.div {...rise(0)}>
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34d399] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34d399]" />
          </span>
          <p className={`${display.className} text-[11px] uppercase tracking-[0.35em] text-[#8bd6b6]`}>
            {t('portal.components.adminConsole.header_kicker')}
          </p>
        </div>
        <h1 className={`${display.className} mt-3 text-5xl font-bold leading-none tracking-tight md:text-6xl`}>
          {t('portal.components.adminConsole.header_title_prefix')}{' '}
          <span className="text-[#8bd6b6]">{t('portal.components.adminConsole.header_title_highlight')}</span>
          <span className="text-[#8bd6b6]">.</span>
        </h1>
      </motion.div>

      {/* HERO doanh thu — con số là tấm áp phích */}
      <motion.section {...rise(1)} className="relative">
        <p className="text-[11px] uppercase tracking-[0.25em] text-[#e2e2e6]/50">
          {t('portal.components.adminConsole.revenue_ytd')}
        </p>
        <p className={`${display.className} mt-2 text-[56px] font-bold leading-[0.95] tracking-tight tabular-nums md:text-[84px]`}>
          {fmtVnd(f.revenue_ytd)}
          <span className="ml-3 align-top text-2xl font-medium text-[#8bd6b6] md:text-3xl">₫</span>
        </p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#e2e2e6]/60">
          <span><b className={`${display.className} tabular-nums text-[#e2e2e6]`}>{f.units_ytd}</b> {t('portal.components.adminConsole.sub_orders_ytd')}</span>
          <span><b className={`${display.className} tabular-nums text-[#e2e2e6]`}>{staffCount}</b> {t('portal.components.adminConsole.sub_staff')}</span>
          <span className={overdueTasks > 0 ? 'text-[#f87171]' : ''}>
            <b className={`${display.className} tabular-nums`}>{overdueTasks}</b> {t('portal.components.adminConsole.sub_overdue')}
          </span>
        </p>
      </motion.section>

      {/* CẦN XỬ LÝ HÔM NAY — hàng đợi việc, cả thẻ là nút */}
      <section>
        <motion.p {...rise(2)} className={`${display.className} mb-3 text-[11px] uppercase tracking-[0.35em] text-[#e2e2e6]/45`}>
          {t('portal.components.adminConsole.group_action')}
        </motion.p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {actions.map((k, i) => (
            <motion.div key={k.label} {...rise(3 + i)}>
              <Link
                href={k.href}
                className="group relative block overflow-hidden rounded-xl border border-[#3f4944]/50 bg-[#1a1c1f]/90 p-5 transition-all hover:-translate-y-0.5"
                style={{ boxShadow: k.value > 0 ? `inset 3px 0 0 ${k.color}` : 'inset 3px 0 0 #3f4944' }}
              >
                {corner}
                <div className="flex items-start justify-between">
                  <span
                    className="material-symbols-outlined rounded-lg border p-1.5 text-[20px]"
                    style={{ color: k.color, borderColor: `${k.color}33`, backgroundColor: `${k.color}14` }}
                  >
                    {k.icon}
                  </span>
                  {k.value > 0 && (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: k.color }} />
                      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: k.color }} />
                    </span>
                  )}
                </div>
                <p className={`${display.className} mt-4 text-4xl font-bold tabular-nums`} style={{ color: k.value > 0 ? k.color : '#e2e2e6' }}>
                  {k.value}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-[#e2e2e6]/50">
                  {k.label}
                  <span className="material-symbols-outlined text-[14px] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" style={{ color: k.color }}>
                    arrow_forward
                  </span>
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* NHỊP KINH DOANH */}
      <section>
        <motion.p {...rise(6)} className={`${display.className} mb-3 text-[11px] uppercase tracking-[0.35em] text-[#e2e2e6]/45`}>
          {t('portal.components.adminConsole.group_pulse')}
        </motion.p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {pulse.map((k, i) => {
            const body = (
              <>
                {corner}
                <div className="pointer-events-none absolute -bottom-5 -right-4 opacity-[0.05] transition-opacity group-hover:opacity-[0.12]">
                  <span className="material-symbols-outlined text-[110px]" style={{ color: k.color }}>{k.icon}</span>
                </div>
                <span
                  className="material-symbols-outlined rounded-lg border p-1.5 text-[20px]"
                  style={{ color: k.color, borderColor: `${k.color}33`, backgroundColor: `${k.color}14` }}
                >
                  {k.icon}
                </span>
                <p className={`${display.className} mt-4 text-3xl font-bold tabular-nums text-[#e2e2e6]`}>{k.value}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#e2e2e6]/50">{k.label}</p>
              </>
            );
            const cls = 'group relative block overflow-hidden rounded-xl border border-[#3f4944]/50 bg-[#1a1c1f]/90 p-5 transition-all hover:-translate-y-0.5';
            return (
              <motion.div key={k.label} {...rise(7 + i)}>
                {k.href
                  ? <Link href={k.href} className={cls}>{body}</Link>
                  : <div className={cls}>{body}</div>}
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
