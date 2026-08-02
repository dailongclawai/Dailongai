'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  currentMonthVn, getAdminFleet, getCrmAccounts, getCrmActivities, getCrmFeedbacks,
  getCrmKpiDeviceMonths, getCrmKpiNewAccountsDays, getCrmStaffReport, getStaffPeers,
} from '@/lib/portal-queries';
import type { FleetSummary } from '@/lib/portal-types';
import { useI18n } from '@/lib/i18n';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

/** Hôm nay theo giờ Việt Nam, dạng yyyy-mm-dd — khớp cột ngay của view KPI. */
function todayVn(): string {
  const vn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return `${vn.getFullYear()}-${String(vn.getMonth() + 1).padStart(2, '0')}-${String(vn.getDate()).padStart(2, '0')}`;
}

// Boss chốt 02/08/2026: Tổng quan admin đo mô hình nhân viên bán qua CRM thay
// cho kênh đại lý phân phối đã ngủ đông (khối đợt chi 5-10 + chính sách chi trả
// đại lý gỡ hẳn; máy móc chi trả đại lý phía sau vẫn nguyên nếu cần dùng lại).
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

  const tiles: { label: string; value: string | number; icon: string; chip: string; tone: string; href?: string }[] = [
    { label: t('portal.components.adminConsole.kpi_units_month'), value: devMonth, icon: 'sell', chip: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', tone: 'text-emerald-400' },
    { label: t('portal.components.adminConsole.kpi_orders_pending'), value: f.orders_pending, icon: 'pending_actions', chip: 'bg-amber-500/10 text-amber-400 border-amber-500/20', tone: 'text-amber-400' },
    { label: t('portal.components.adminConsole.kpi_pending_confirm'), value: pendingConfirm, icon: 'hourglass_top', chip: 'bg-[#fbbf24]/10 text-[#fbbf24] border-[#fbbf24]/20', tone: 'text-[#fbbf24]', href: '/portal/crm/accounts' },
    { label: t('portal.components.adminConsole.kpi_staff_commission'), value: fmtVnd(staffCommission), icon: 'payments', chip: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20', tone: 'text-[#3b82f6]', href: '/portal/crm/commission' },
    { label: t('portal.components.adminConsole.kpi_new_today'), value: newToday, icon: 'person_add', chip: 'bg-[#00daf3]/10 text-[#00daf3] border-[#00daf3]/20', tone: 'text-[#00daf3]' },
    { label: t('portal.components.adminConsole.kpi_unread_feedback'), value: unreadFeedback, icon: 'mark_email_unread', chip: 'bg-[#ff5625]/10 text-[#ff5625] border-[#ff5625]/20', tone: 'text-[#ff5625]', href: '/portal/crm/feedback' },
  ];

  const tileBody = (k: (typeof tiles)[number]) => (
    <>
      <div className="pointer-events-none absolute -bottom-4 -right-4 opacity-[0.03] transition-opacity group-hover:opacity-[0.08]">
        <span className="material-symbols-outlined text-[96px]">{k.icon}</span>
      </div>
      <span className={`material-symbols-outlined rounded-lg border p-1.5 text-[20px] ${k.chip}`}>{k.icon}</span>
      <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#e7eaf0]/50">{k.label}</p>
      <p className={`mt-1 font-mono tabular-nums text-3xl font-medium ${k.tone}`}>{k.value}</p>
    </>
  );

  return (
    <div className="space-y-12 py-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5625]">{t('portal.components.adminConsole.header_kicker')}</p>
        <h1 className="mt-2 font-headline text-5xl leading-none tracking-tight">
          {t('portal.components.adminConsole.header_title_prefix')} <span>{t('portal.components.adminConsole.header_title_highlight')}</span>.
        </h1>
      </div>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-5">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#e7eaf0]/50">{t('portal.components.adminConsole.revenue_ytd')}</p>
          <p className="mt-2 font-headline text-[40px] leading-[0.95] tracking-tight md:text-[56px]">
            {fmtVnd(f.revenue_ytd)}
            <span className="ml-2 align-top font-mono tabular-nums text-2xl text-[#ff5625]">₫</span>
          </p>
          <p className="mt-3 text-sm text-[#e7eaf0]/60">
            <span className="font-mono tabular-nums">{f.units_ytd}</span> {t('portal.components.adminConsole.sub_orders_ytd')}
            {' · '}<span className="font-mono tabular-nums">{staffCount}</span> {t('portal.components.adminConsole.sub_staff')}
            {' · '}<span className="font-mono tabular-nums">{overdueTasks}</span> {t('portal.components.adminConsole.sub_overdue')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:col-span-7 lg:grid-cols-3">
          {tiles.map(k => (
            k.href ? (
              <Link key={k.label} href={k.href} className="group relative overflow-hidden rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-4 transition-colors hover:border-[#ff5625]/50">
                {tileBody(k)}
              </Link>
            ) : (
              <div key={k.label} className="group relative overflow-hidden rounded-xl border border-[#1f2937]/40 bg-[#11151a] p-4">
                {tileBody(k)}
              </div>
            )
          ))}
        </div>
      </section>
    </div>
  );
}
