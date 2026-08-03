'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { currentMonthVn, getCrmKpiDeviceMonths, getCrmKpiNewAccountsDays } from '@/lib/portal-queries';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import { HBarList, MonthlyBarChart } from '@/components/portal/CrmReportCharts';
import {
  DAILY_ORG_MAX, DAILY_ORG_MIN, DAILY_RETAIL_MAX, DAILY_RETAIL_MIN,
  KPI_BONUS_FROM_DEVICE, dailyKpiMet, kpiStatus, type KpiStatus,
} from '@/lib/crm-kpi';
import type { CrmKpiDeviceMonth, CrmKpiNewAccountsDay } from '@/lib/portal-types';

// Cùng bảng màu trạng thái với STATUS_STYLE của trang Khách hàng.
const BADGE_CLASS: Record<KpiStatus, string> = {
  missed: 'text-[#f87171] border-[#f87171]/40',
  met: 'text-[#ffb77d] border-[#ffb77d]/40',
  excellent: 'text-[#ff8a50] border-[#ff8a50]/40',
};

/** Hôm nay theo giờ Việt Nam, cùng dạng yyyy-mm-dd với cột ngay của view. */
function todayVn(): string {
  const vn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return `${vn.getFullYear()}-${String(vn.getMonth() + 1).padStart(2, '0')}-${String(vn.getDate()).padStart(2, '0')}`;
}

const monthLabel = (thang: string) => `${Number(thang.slice(5, 7))}/${thang.slice(2, 4)}`;
const dayLabel = (ngay: string) => `${Number(ngay.slice(8, 10))}/${Number(ngay.slice(5, 7))}`;

// Chu vi vòng gauge r=45 trong viewBox 100×100.
const GAUGE_C = 2 * Math.PI * 45;

export default function CrmKpiPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [months, setMonths] = useState<CrmKpiDeviceMonth[]>([]);
  const [days, setDays] = useState<CrmKpiNewAccountsDay[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !session) router.replace('/portal/login');
  }, [loading, session, router]);

  // Boss chốt 28/07/2026: CRM chỉ mở cho staff và admin
  useEffect(() => {
    if (!loading && profile && profile.role !== 'staff' && profile.role !== 'admin') {
      router.replace('/portal/403');
    }
  }, [loading, profile, router]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [m, d] = await Promise.all([getCrmKpiDeviceMonths(), getCrmKpiNewAccountsDays()]);
      setMonths(m);
      setDays(d);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const isAdmin = profile?.role === 'admin';
  const curMonth = currentMonthVn();
  const today = todayVn();

  // Dòng tháng/ngày hiện tại từng nhân viên. RLS đã cắt: nhân viên chỉ có mình.
  const curRows = useMemo(() => months.filter(m => m.thang === curMonth), [months, curMonth]);
  const todayRows = useMemo(() => days.filter(d => d.ngay === today), [days, today]);

  // Cả đội cộng lại theo tháng, cho biểu đồ admin.
  const teamByMonth = useMemo(() => {
    const acc = new Map<string, number>();
    for (const m of months) acc.set(m.thang, (acc.get(m.thang) ?? 0) + m.devices_won);
    return [...acc.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [months]);

  if (loading || !profile) return null;

  const mine = !isAdmin ? curRows[0] : undefined;
  const mineToday = !isAdmin ? todayRows[0] : undefined;

  const card = 'rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)] p-5';

  const statusBadge = (devices: number, tenure: number) => {
    const s = kpiStatus(devices, tenure);
    const key = s === 'excellent'
      ? (tenure <= 1 ? 'portal.crm.kpi.status_great' : 'portal.crm.kpi.status_excellent')
      : s === 'met' ? 'portal.crm.kpi.status_met' : 'portal.crm.kpi.status_missed';
    return (
      <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${BADGE_CLASS[s]}`}>
        {t(key)}
      </span>
    );
  };

  const dailyBadge = (retail: number, org: number) => (
    <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${
      dailyKpiMet(retail, org) ? BADGE_CLASS.excellent : BADGE_CLASS.missed
    }`}>
      {t(dailyKpiMet(retail, org) ? 'portal.crm.kpi.daily_met' : 'portal.crm.kpi.daily_missed')}
    </span>
  );

  const deviceHint = (label: string, n: number) => `${label}: ${n} ${t('portal.crm.kpi.devices')}`;

  // Dải 14 ô đạt/trượt chỉ tiêu khách mới theo ngày — xanh ✓ đạt, đỏ ✗ trượt.
  const dailyStrip = (list: CrmKpiNewAccountsDay[]) => (
    <div className="flex flex-wrap items-end gap-1.5">
      {list.map(d => {
        const met = dailyKpiMet(d.retail_new, d.org_new);
        return (
          <div
            key={d.ngay}
            className="flex flex-col items-center gap-1"
            title={`${dayLabel(d.ngay)}: ${d.retail_new} ${t('portal.crm.kpi.daily_retail')} · ${d.org_new} ${t('portal.crm.kpi.daily_org')} — ${t(met ? 'portal.crm.kpi.daily_met' : 'portal.crm.kpi.daily_missed')}`}
          >
            <span className={`material-symbols-outlined flex h-7 w-7 items-center justify-center rounded-md text-[15px] ${
              met ? 'bg-[#ff8a50]/20 text-[#ff8a50]' : 'bg-[#f87171]/10 text-[#f87171]/70'
            }`}>
              {met ? 'check' : 'close'}
            </span>
            <span className="text-[10px] text-[var(--crm-muted)]">{dayLabel(d.ngay)}</span>
          </div>
        );
      })}
    </div>
  );

  /** Card KPI phụ có progress bar — icon, nhãn, % đạt, số / dải chỉ tiêu. */
  const activityCard = (icon: string, labelKey: string, value: number, goalMin: number, goalMax: number) => {
    const pct = Math.min(100, Math.round((value / goalMin) * 100));
    return (
      <section className={card}>
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-[var(--crm-s3)] text-[#ff8a50]">
              <span className="material-symbols-outlined">{icon}</span>
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-medium text-[var(--crm-text)]">{t(labelKey)}</h3>
              <p className="mt-0.5 text-[11px] uppercase tracking-wider text-[var(--crm-muted)]">
                {t('portal.crm.kpi.goal_pct_pre')} {pct}{t('portal.crm.kpi.goal_pct_post')}
              </p>
            </div>
          </div>
          <p className="shrink-0 whitespace-nowrap text-right">
            <span className="crm-display text-2xl font-bold tabular-nums text-[#ff8a50]">{value}</span>
            <span className="font-mono text-sm tabular-nums text-[var(--crm-muted)]">
              {' '}/ {goalMin}–{goalMax} {t('portal.crm.kpi.daily_goal')}
            </span>
          </p>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--crm-s3)]">
          <div
            className="relative h-full rounded-full bg-[#ff8a50] transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          >
            <div className="absolute inset-y-0 right-0 w-3 bg-white/20 blur-[2px]" />
          </div>
        </div>
      </section>
    );
  };

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <CrmNav />
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--crm-text)]">{t('portal.crm.kpi.title')}</h1>
          <p className="mt-1 text-sm text-[var(--crm-muted)]">{t('portal.crm.kpi.subtitle')}</p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-lg border border-[var(--crm-line)] bg-[var(--crm-s1)] px-3 py-2">
          <span className="material-symbols-outlined text-[18px] text-[#ff8a50]">calendar_month</span>
          <span className="font-mono text-sm tabular-nums text-[var(--crm-text)]">
            {t('portal.crm.kpi.month_chip_pre')} {Number(curMonth.slice(5, 7))}/{curMonth.slice(0, 4)}
          </span>
        </div>
      </div>

      {/* Luật chung — nhìn một chỗ là biết cả bộ KPI */}
      <section className={`${card} mb-6`}>
        <h2 className="mb-3 font-bold text-[var(--crm-text)]">{t('portal.crm.kpi.rules_title')}</h2>
        <ul className="grid gap-2 text-sm text-[var(--crm-muted)] md:grid-cols-2">
          {(['rule_m1', 'rule_m2', 'rule_bonus', 'rule_daily'] as const).map(k => (
            <li key={k} className="flex items-start gap-2">
              <span className="material-symbols-outlined mt-0.5 text-[16px] text-[#ff8a50]">check_circle</span>
              {t('portal.crm.kpi.' + k)}
            </li>
          ))}
        </ul>
      </section>

      {busy && <p className="text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</p>}

      {!busy && !isAdmin && !mine && (
        <p className="text-[var(--crm-muted)]">{t('portal.crm.kpi.empty')}</p>
      )}

      {!busy && !isAdmin && mine && (() => {
        const gaugePct = Math.min(1, mine.devices_won / Math.max(mine.kpi_target, 1));
        const last6 = months.slice(-6);
        const chartMax = Math.max(...last6.map(m => m.devices_won), mine.kpi_target, 1);
        const bonusOn = mine.devices_won >= KPI_BONUS_FROM_DEVICE;
        const retailToday = mineToday?.retail_new ?? 0;
        const orgToday = mineToday?.org_new ?? 0;
        return (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* ── Cột trái: gauge + 6 tháng + card thưởng ── */}
            <div className="flex flex-col gap-4 lg:col-span-5">
              <section className={`${card} relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden`}>
                <div
                  className="pointer-events-none absolute inset-0 opacity-10"
                  style={{ background: 'radial-gradient(circle at center, rgba(255, 138, 80, 0.5) 0%, transparent 70%)' }}
                />
                <div className="relative mb-4 h-48 w-48">
                  <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={`${mine.devices_won} / ${mine.kpi_target} ${t('portal.crm.kpi.devices')}`}>
                    <circle cx={50} cy={50} r={45} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
                    {/* Vạch mốc chỉ tiêu (gauge chia theo chỉ tiêu → mốc nằm đỉnh vòng) */}
                    <line x1={50} y1={1.5} x2={50} y2={11} stroke="#d97706" strokeWidth={1.5} strokeDasharray="2,2" opacity={0.7} />
                    <circle
                      cx={50} cy={50} r={45} fill="none"
                      stroke="#ff8a50" strokeWidth={6} strokeLinecap="round"
                      strokeDasharray={GAUGE_C}
                      strokeDashoffset={GAUGE_C * (1 - gaugePct)}
                      transform="rotate(-90 50 50)"
                      style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="crm-display text-5xl font-bold tabular-nums text-[#ff8a50]">{mine.devices_won}</span>
                    <span className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[var(--crm-muted)]">
                      / {mine.kpi_target} {t('portal.crm.kpi.devices')}
                    </span>
                  </div>
                </div>
                <div className="z-10 flex flex-col items-center gap-2 text-center">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-[var(--crm-text)]">{t('portal.crm.kpi.month_title')}</h2>
                    {statusBadge(mine.devices_won, mine.tenure_month)}
                  </div>
                  <p className="text-xs text-[var(--crm-muted)]">
                    {t('portal.crm.kpi.tenure_pre')} {mine.tenure_month} · {t('portal.crm.kpi.excellent')}: &gt;{mine.kpi_excellent} {t('portal.crm.kpi.devices')}
                  </p>
                </div>
              </section>

              <section className={card}>
                <h2 className="mb-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--crm-muted)]">
                  <span>{t('portal.crm.kpi.chart6_title')}</span>
                  <span className="material-symbols-outlined text-sm">bar_chart</span>
                </h2>
                <div className="relative h-[132px]">
                  <div
                    className="pointer-events-none absolute left-0 z-0 flex w-full items-center border-t border-dashed border-[#d97706]/50"
                    style={{ bottom: `${(mine.kpi_target / chartMax) * 112}px` }}
                  >
                    <span className="absolute -top-4 right-0 text-[10px] uppercase tracking-wider text-[#ffb77d]">
                      {t('portal.crm.kpi.target_short')}: {mine.kpi_target}
                    </span>
                  </div>
                  <div className="flex h-full items-end justify-between gap-2">
                    {last6.map(m => {
                      const cur = m.thang === curMonth;
                      return (
                        <div
                          key={m.thang}
                          className="group z-10 flex flex-1 flex-col items-center justify-end gap-1"
                          title={deviceHint(monthLabel(m.thang), m.devices_won)}
                        >
                          <span className="font-mono text-[10px] tabular-nums text-[var(--crm-muted)] opacity-0 transition-opacity group-hover:opacity-100">
                            {m.devices_won}
                          </span>
                          <div
                            className={`w-full rounded-t-sm transition-colors ${
                              cur ? 'bg-[#ff8a50]' : 'bg-[#ff8a50]/30 group-hover:bg-[#ff8a50]/60'
                            }`}
                            style={{ height: `${m.devices_won > 0 ? Math.max(6, (m.devices_won / chartMax) * 112) : 2}px` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-2 flex justify-between gap-2">
                  {last6.map(m => (
                    <span
                      key={m.thang}
                      className={`flex-1 text-center font-mono text-[10px] tabular-nums ${
                        m.thang === curMonth ? 'text-[#ff8a50]' : 'text-[var(--crm-muted)]'
                      }`}
                    >
                      {monthLabel(m.thang)}
                    </span>
                  ))}
                </div>
              </section>

              {/* Card ghi chú gold — mốc thưởng +5% từ máy thứ 10 (KPI_BONUS_FROM_DEVICE) */}
              <section className="rounded-2xl border border-[#d97706]/30 bg-[#d97706]/10 p-5">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined mt-0.5 text-[#ffb77d]">stars</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-[#ffb77d]">{t('portal.crm.kpi.bonus_title')}</h2>
                    {bonusOn ? (
                      <p className="mt-1 text-sm font-medium text-[#ff8a50]">{t('portal.crm.kpi.bonus_on')}</p>
                    ) : (
                      <>
                        <p className="mt-1 text-sm text-[var(--crm-text)]">
                          {t('portal.crm.kpi.bonus_left_pre')}{' '}
                          <b>{KPI_BONUS_FROM_DEVICE - mine.devices_won}</b>{' '}
                          {t('portal.crm.kpi.bonus_left_post')}
                        </p>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--crm-s3)]">
                          <div
                            className="h-full rounded-full bg-[#d97706] transition-[width] duration-700 ease-out"
                            style={{ width: `${Math.min(100, (mine.devices_won / KPI_BONUS_FROM_DEVICE) * 100)}%` }}
                          />
                        </div>
                        <p className="mt-1.5 font-mono text-xs tabular-nums text-[var(--crm-muted)]">
                          {mine.devices_won} / {KPI_BONUS_FROM_DEVICE} {t('portal.crm.kpi.devices')}
                        </p>
                      </>
                    )}
                    <p className="mt-2 text-xs text-[#ffb77d]/70">{t('portal.crm.kpi.rule_bonus')}</p>
                  </div>
                </div>
              </section>
            </div>

            {/* ── Cột phải: chỉ tiêu hoạt động + dải 14 ngày + biểu đồ ngày ── */}
            <div className="flex flex-col gap-4 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--crm-muted)]">
                  {t('portal.crm.kpi.activity_caps')}
                </p>
                {dailyBadge(retailToday, orgToday)}
              </div>
              {activityCard('group_add', 'portal.crm.kpi.daily_retail', retailToday, DAILY_RETAIL_MIN, DAILY_RETAIL_MAX)}
              {activityCard('domain', 'portal.crm.kpi.daily_org', orgToday, DAILY_ORG_MIN, DAILY_ORG_MAX)}

              <section className={card}>
                <h2 className="mb-1 font-bold text-[var(--crm-text)]">{t('portal.crm.kpi.daily_strip_title')}</h2>
                <p className="mb-3 text-xs text-[var(--crm-muted)]">{t('portal.crm.kpi.daily_strip_hint')}</p>
                {dailyStrip(days)}
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <section className={card}>
                  <h2 className="mb-3 font-bold text-[var(--crm-text)]">{t('portal.crm.kpi.chart_retail14')}</h2>
                  <MonthlyBarChart
                    data={days.map(d => ({
                      label: dayLabel(d.ngay),
                      value: d.retail_new,
                      hint: `${dayLabel(d.ngay)}: ${d.retail_new}`,
                    }))}
                    ariaLabel={t('portal.crm.kpi.chart_retail14')}
                  />
                </section>
                <section className={card}>
                  <h2 className="mb-3 font-bold text-[var(--crm-text)]">{t('portal.crm.kpi.chart_org14')}</h2>
                  <MonthlyBarChart
                    data={days.map(d => ({
                      label: dayLabel(d.ngay),
                      value: d.org_new,
                      hint: `${dayLabel(d.ngay)}: ${d.org_new}`,
                    }))}
                    ariaLabel={t('portal.crm.kpi.chart_org14')}
                  />
                </section>
              </div>
            </div>
          </div>
        );
      })()}

      {!busy && isAdmin && (
        <>
          <section className="mb-6 overflow-x-auto rounded-2xl border border-[var(--crm-line)]">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[var(--crm-s3)] text-[var(--crm-muted)]">
                <tr>
                  <th className="px-4 py-3">{t('portal.crm.kpi.col_staff')}</th>
                  <th className="px-4 py-3 text-right">{t('portal.crm.kpi.col_tenure')}</th>
                  <th className="px-4 py-3 text-right">{t('portal.crm.kpi.col_devices')}</th>
                  <th className="px-4 py-3 text-right">{t('portal.crm.kpi.col_target')}</th>
                  <th className="px-4 py-3">{t('portal.crm.kpi.col_status')}</th>
                  <th className="px-4 py-3 text-center">{t('portal.crm.kpi.col_bonus')}</th>
                  <th className="px-4 py-3 text-right">{t('portal.crm.kpi.col_retail')}</th>
                  <th className="px-4 py-3 text-right">{t('portal.crm.kpi.col_org')}</th>
                  <th className="px-4 py-3">{t('portal.crm.kpi.col_daily')}</th>
                </tr>
              </thead>
              <tbody>
                {curRows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.kpi.empty')}</td></tr>
                )}
                {curRows.map(r => {
                  const td = todayRows.find(d => d.staff_id === r.staff_id);
                  return (
                    <tr key={r.staff_id} className="border-t border-[var(--crm-line)]">
                      <td className="px-4 py-3 text-[var(--crm-text)]">{r.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--crm-muted)]">{r.tenure_month}</td>
                      <td className="px-4 py-3 text-right font-mono text-lg font-bold tabular-nums text-[var(--crm-text)]">{r.devices_won}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--crm-muted)]">
                        {r.kpi_target} / &gt;{r.kpi_excellent}
                      </td>
                      <td className="px-4 py-3">{statusBadge(r.devices_won, r.tenure_month)}</td>
                      <td className="px-4 py-3 text-center">
                        {r.devices_won >= KPI_BONUS_FROM_DEVICE
                          ? <span className="material-symbols-outlined text-[18px] text-[#ff8a50]">bolt</span>
                          : <span className="text-[var(--crm-muted)]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--crm-text)]">
                        {td?.retail_new ?? 0}
                        <span className="text-[var(--crm-muted)]"> / {DAILY_RETAIL_MIN}–{DAILY_RETAIL_MAX}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--crm-text)]">
                        {td?.org_new ?? 0}
                        <span className="text-[var(--crm-muted)]"> / {DAILY_ORG_MIN}–{DAILY_ORG_MAX}</span>
                      </td>
                      <td className="px-4 py-3">{dailyBadge(td?.retail_new ?? 0, td?.org_new ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className={card}>
              <h2 className="mb-3 font-bold text-[var(--crm-text)]">{t('portal.crm.kpi.team_devices_title')}</h2>
              <HBarList
                data={curRows.map(r => ({
                  label: r.full_name ?? '—',
                  value: r.devices_won,
                  hint: deviceHint(r.full_name ?? '—', r.devices_won),
                }))}
                color="#d97706"
              />
            </section>
            <section className={card}>
              <h2 className="mb-3 font-bold text-[var(--crm-text)]">{t('portal.crm.kpi.chart_team_devices')}</h2>
              <MonthlyBarChart
                data={teamByMonth.map(([thang, v]) => ({
                  label: monthLabel(thang),
                  value: v,
                  hint: deviceHint(monthLabel(thang), v),
                }))}
                ariaLabel={t('portal.crm.kpi.chart_team_devices')}
              />
            </section>
          </div>

          <section className={`${card} mt-4`}>
            <h2 className="mb-1 font-bold text-[var(--crm-text)]">{t('portal.crm.kpi.daily_strip_title')}</h2>
            <p className="mb-3 text-xs text-[var(--crm-muted)]">{t('portal.crm.kpi.daily_strip_hint')}</p>
            <div className="space-y-4">
              {curRows.map(r => (
                <div key={r.staff_id}>
                  <p className="mb-1.5 text-sm text-[var(--crm-text)]">{r.full_name ?? '—'}</p>
                  {dailyStrip(days.filter(d => d.staff_id === r.staff_id))}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </PortalShell>
  );
}
