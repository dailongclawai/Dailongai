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
  met: 'text-[#00daf3] border-[#00daf3]/40',
  excellent: 'text-[#34d399] border-[#34d399]/40',
};

/** Hôm nay theo giờ Việt Nam, cùng dạng yyyy-mm-dd với cột ngay của view. */
function todayVn(): string {
  const vn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return `${vn.getFullYear()}-${String(vn.getMonth() + 1).padStart(2, '0')}-${String(vn.getDate()).padStart(2, '0')}`;
}

const monthLabel = (thang: string) => `${Number(thang.slice(5, 7))}/${thang.slice(2, 4)}`;
const dayLabel = (ngay: string) => `${Number(ngay.slice(8, 10))}/${Number(ngay.slice(5, 7))}`;

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

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <CrmNav />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold text-[var(--crm-text)]">{t('portal.crm.kpi.title')}</h1>
      </div>

      {/* Luật chung — nhìn một chỗ là biết cả bộ KPI */}
      <section className={`${card} mb-6`}>
        <h2 className="mb-3 font-bold text-[var(--crm-text)]">{t('portal.crm.kpi.rules_title')}</h2>
        <ul className="grid gap-2 text-sm text-[var(--crm-muted)] md:grid-cols-2">
          {(['rule_m1', 'rule_m2', 'rule_bonus', 'rule_daily'] as const).map(k => (
            <li key={k} className="flex items-start gap-2">
              <span className="material-symbols-outlined mt-0.5 text-[16px] text-[#ff5625]">check_circle</span>
              {t('portal.crm.kpi.' + k)}
            </li>
          ))}
        </ul>
      </section>

      {busy && <p className="text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</p>}

      {!busy && !isAdmin && !mine && (
        <p className="text-[var(--crm-muted)]">{t('portal.crm.kpi.empty')}</p>
      )}

      {!busy && !isAdmin && mine && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <section className={card}>
              <h2 className="mb-1 text-sm text-[var(--crm-muted)]">{t('portal.crm.kpi.month_title')}</h2>
              <div className="flex items-end justify-between gap-2">
                <p className="text-3xl font-bold text-[var(--crm-text)]">
                  {mine.devices_won}
                  <span className="ml-1 text-sm font-normal text-[var(--crm-muted)]">
                    / {mine.kpi_target} {t('portal.crm.kpi.devices')}
                  </span>
                </p>
                {statusBadge(mine.devices_won, mine.tenure_month)}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--crm-s3)]">
                <div
                  className={`h-full rounded-full ${mine.devices_won >= mine.kpi_target ? 'bg-[#34d399]' : 'bg-[#00daf3]'}`}
                  style={{ width: `${Math.min(100, (mine.devices_won / mine.kpi_target) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[var(--crm-muted)]">
                {t('portal.crm.kpi.tenure_pre')} {mine.tenure_month} · {t('portal.crm.kpi.excellent')}: &gt;{mine.kpi_excellent} {t('portal.crm.kpi.devices')}
              </p>
            </section>

            <section className={card}>
              <h2 className="mb-1 text-sm text-[var(--crm-muted)]">{t('portal.crm.kpi.bonus_title')}</h2>
              {mine.devices_won >= KPI_BONUS_FROM_DEVICE ? (
                <p className="text-sm font-medium text-[#34d399]">{t('portal.crm.kpi.bonus_on')}</p>
              ) : (
                <p className="text-sm text-[var(--crm-text)]">
                  {t('portal.crm.kpi.bonus_left_pre')}{' '}
                  <b>{KPI_BONUS_FROM_DEVICE - mine.devices_won}</b>{' '}
                  {t('portal.crm.kpi.bonus_left_post')}
                </p>
              )}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--crm-s3)]">
                <div
                  className="h-full rounded-full bg-[#ff5625]"
                  style={{ width: `${Math.min(100, (mine.devices_won / KPI_BONUS_FROM_DEVICE) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[var(--crm-muted)]">
                {mine.devices_won} / {KPI_BONUS_FROM_DEVICE} {t('portal.crm.kpi.devices')}
              </p>
            </section>

            <section className={card}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="text-sm text-[var(--crm-muted)]">{t('portal.crm.kpi.daily_title')}</h2>
                {dailyBadge(mineToday?.retail_new ?? 0, mineToday?.org_new ?? 0)}
              </div>
              <div className="mt-2 space-y-2 text-sm text-[var(--crm-text)]">
                <p className="flex items-baseline justify-between">
                  <span>{t('portal.crm.kpi.daily_retail')}</span>
                  <span className="font-mono tabular-nums">
                    <b className="text-xl">{mineToday?.retail_new ?? 0}</b>
                    <span className="text-[var(--crm-muted)]"> / {DAILY_RETAIL_MIN}–{DAILY_RETAIL_MAX} {t('portal.crm.kpi.daily_goal')}</span>
                  </span>
                </p>
                <p className="flex items-baseline justify-between">
                  <span>{t('portal.crm.kpi.daily_org')}</span>
                  <span className="font-mono tabular-nums">
                    <b className="text-xl">{mineToday?.org_new ?? 0}</b>
                    <span className="text-[var(--crm-muted)]"> / {DAILY_ORG_MIN}–{DAILY_ORG_MAX} {t('portal.crm.kpi.daily_goal')}</span>
                  </span>
                </p>
              </div>
            </section>
          </div>

          <section className={`${card} mb-6`}>
            <h2 className="mb-3 font-bold text-[var(--crm-text)]">{t('portal.crm.kpi.chart_devices')}</h2>
            <MonthlyBarChart
              data={months.map(m => ({
                label: monthLabel(m.thang),
                value: m.devices_won,
                hint: deviceHint(monthLabel(m.thang), m.devices_won),
              }))}
              ariaLabel={t('portal.crm.kpi.chart_devices')}
            />
          </section>

          <div className="grid gap-4 md:grid-cols-2">
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
        </>
      )}

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
                          ? <span className="material-symbols-outlined text-[18px] text-[#34d399]">bolt</span>
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
                color="#00daf3"
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
        </>
      )}
    </PortalShell>
  );
}
