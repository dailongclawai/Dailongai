'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getCrmAccounts, getCrmActivities, getCrmBoard, getCrmStages } from '@/lib/portal-queries';
import { sumAmount, weightedForecast } from '@/lib/crm-board';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import type { CrmAccountListRow, CrmActivityRow, CrmOpportunityBoardRow, CrmStage } from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const DAY_MS = 86_400_000;

/** Số ngày từ hôm nay tới hạn đóng dự kiến. Âm là đã quá hạn. */
function daysLeft(dateStr: string, today: Date): number {
  const due = new Date(dateStr);
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((b - a) / DAY_MS);
}

export default function CrmDashboardPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [rows, setRows] = useState<CrmOpportunityBoardRow[]>([]);
  const [activities, setActivities] = useState<CrmActivityRow[]>([]);
  const [accounts, setAccounts] = useState<CrmAccountListRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

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
      const [s, r, a, c] = await Promise.all([
        getCrmStages(),
        getCrmBoard(),
        getCrmActivities(),
        getCrmAccounts(),
      ]);
      setStages(s);
      setRows(r);
      setActivities(a);
      setAccounts(c);
      setLoadedAt(new Date().toLocaleString('vi-VN', {
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
      }));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const openRows = useMemo(() => rows.filter(r => r.forecast === 'open'), [rows]);
  const wonCount = useMemo(() => rows.filter(r => r.forecast === 'won').length, [rows]);
  const lostCount = useMemo(() => rows.filter(r => r.forecast === 'lost').length, [rows]);
  const closedCount = wonCount + lostCount;
  const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 1000) / 10 : 0;

  const newAccounts = useMemo(() => {
    const from = Date.now() - 30 * DAY_MS;
    return accounts.filter(a => new Date(a.created_at).getTime() >= from).length;
  }, [accounts]);

  // Phễu: mỗi bậc đếm số cơ hội đã đi qua bậc đó (đang ở bậc này hoặc xa hơn).
  // Cơ hội thua bị loại vì chúng rơi khỏi chuỗi chứ không đi tiếp.
  const funnel = useMemo(() => {
    const order = new Map(stages.map(s => [s.id, s.sort_order]));
    const alive = rows.filter(r => r.forecast !== 'lost');
    const steps = [...stages]
      .filter(s => s.forecast !== 'lost')
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(s => ({
        stage: s,
        count: alive.filter(r => (order.get(r.stage_id) ?? 0) >= s.sort_order).length,
      }));
    const top = steps[0]?.count ?? 0;
    return steps.map((step, i) => ({
      ...step,
      width: top > 0 ? Math.round((step.count / top) * 100) : 0,
      keepPct: i > 0 && steps[i - 1].count > 0
        ? Math.round((step.count / steps[i - 1].count) * 100)
        : null,
    }));
  }, [stages, rows]);

  // Việc quá hạn và việc tới hạn hôm nay, sớm nhất lên trước.
  const todayTasks = useMemo(() => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return activities
      .filter(a => !a.done_at && a.due_at && new Date(a.due_at) <= endOfToday)
      .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
      .slice(0, 5);
  }, [activities]);

  // Cơ hội đang mở tới hạn đóng trong 7 ngày tới hoặc đã quá hạn.
  const urgent = useMemo(() => {
    const today = new Date();
    return openRows
      .map(r => ({ row: r, left: daysLeft(r.expected_close_date, today) }))
      .filter(x => x.left <= 7)
      .sort((a, b) => a.left - b.left)
      .slice(0, 6);
  }, [openRows]);

  const overdueCount = urgent.filter(x => x.left < 0).length;

  if (loading || !profile) return null;

  const card = 'rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)]';

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <CrmNav />

      <div className="mb-5">
        <h1 className="crm-display text-xl font-semibold text-[var(--crm-text)]">{t('portal.crm.dash.title')}</h1>
        <p className="mt-1 text-xs text-[var(--crm-muted)]">
          {busy ? t('portal.crm.common.loading') : `${t('portal.crm.dash.updated')} ${loadedAt ?? ''}`}
        </p>
      </div>

      {/* Ba chỉ số chính */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className={`${card} p-5`}>
          <div className="mb-4 flex items-start justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--crm-s3)] text-[#ff5625]">
              <span className="material-symbols-outlined text-[20px]">payments</span>
            </span>
            <span className="rounded-full bg-[#00daf3]/10 px-2.5 py-1 text-xs text-[#00daf3]">
              {t('portal.crm.dash.deals_open')}: {openRows.length}
            </span>
          </div>
          <p className="text-[11px] uppercase tracking-[0.05em] text-[var(--crm-muted)]">{t('portal.crm.dash.open_value')}</p>
          <p className="crm-display mt-1 text-2xl font-semibold tabular-nums text-[var(--crm-text)]">{fmtVnd(sumAmount(openRows))}đ</p>
          <p className="mt-2 text-xs text-[var(--crm-muted)]">
            {t('portal.crm.pipeline.forecast')}:{' '}
            <span className="tabular-nums text-[#00daf3]">{fmtVnd(weightedForecast(openRows))}đ</span>
          </p>
        </div>

        <div className={`${card} p-5`}>
          <div className="mb-4 flex items-start justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--crm-s3)] text-[#34d399]">
              <span className="material-symbols-outlined text-[20px]">trending_up</span>
            </span>
            <span className="rounded-full bg-[var(--crm-s3)] px-2.5 py-1 text-xs text-[var(--crm-muted)]">
              {closedCount} {t('portal.crm.dash.closed_deals')}
            </span>
          </div>
          <p className="text-[11px] uppercase tracking-[0.05em] text-[var(--crm-muted)]">{t('portal.crm.dash.win_rate')}</p>
          <p className="crm-display mt-1 text-2xl font-semibold tabular-nums text-[var(--crm-text)]">{winRate}%</p>
          <p className="mt-2 text-xs text-[var(--crm-muted)]">
            <span className="text-[#34d399]">{wonCount}</span> {t('portal.crm.dash.won')} ·{' '}
            <span className="text-[#f87171]">{lostCount}</span> {t('portal.crm.dash.lost')}
          </p>
        </div>

        <div className={`${card} p-5`}>
          <div className="mb-4 flex items-start justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--crm-s3)] text-[#00daf3]">
              <span className="material-symbols-outlined text-[20px]">person_add</span>
            </span>
            <span className="rounded-full bg-[var(--crm-s3)] px-2.5 py-1 text-xs text-[var(--crm-muted)]">
              {t('portal.crm.dash.total')}: {accounts.length}
            </span>
          </div>
          <p className="text-[11px] uppercase tracking-[0.05em] text-[var(--crm-muted)]">{t('portal.crm.dash.new_accounts')}</p>
          <p className="crm-display mt-1 text-2xl font-semibold tabular-nums text-[var(--crm-text)]">{newAccounts}</p>
          <p className="mt-2 text-xs text-[var(--crm-muted)]">{t('portal.crm.dash.last_30_days')}</p>
        </div>
      </div>

      {/* Phễu chuyển đổi + việc trong ngày */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className={`${card} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="crm-display text-[18px] font-medium text-[var(--crm-text)]">{t('portal.crm.dash.funnel')}</h2>
            <Link href="/portal/crm/pipeline" className="text-xs text-[#00daf3] hover:underline">
              {t('portal.crm.dash.view_all')}
            </Link>
          </div>
          {busy && <p className="text-sm text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</p>}
          {!busy && funnel.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--crm-muted)]">{t('portal.crm.dash.empty')}</p>
          )}
          <div className="space-y-3">
            {funnel.map(step => (
              <div key={step.stage.id}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="text-[var(--crm-text)]">{step.stage.name}</span>
                  <span className="crm-display tabular-nums text-[var(--crm-text)]">{step.count}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-7 flex-1 overflow-hidden rounded-lg bg-[var(--crm-s3)]">
                    <div
                      className="h-full rounded-lg"
                      style={{
                        width: `${step.width}%`,
                        backgroundColor: step.stage.forecast === 'won' ? '#00daf3' : '#ff5625',
                      }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-[var(--crm-muted)]">
                    {step.keepPct !== null ? `${step.keepPct}%` : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={`${card} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="crm-display text-[18px] font-medium text-[var(--crm-text)]">{t('portal.crm.dash.today_tasks')}</h2>
            <Link href="/portal/crm/activities" className="text-xs text-[#00daf3] hover:underline">
              {t('portal.crm.dash.view_all')}
            </Link>
          </div>
          <ul className="space-y-2">
            {todayTasks.map(a => {
              const late = a.due_at ? new Date(a.due_at) < new Date() : false;
              return (
                <li key={a.id} className="flex gap-3 rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s2)] p-3">
                  <span className={`crm-display shrink-0 text-sm tabular-nums ${late ? 'text-[#f87171]' : 'text-[#ff5625]'}`}>
                    {a.due_at ? new Date(a.due_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--crm-text)]">{a.subject}</p>
                    <p className="truncate text-xs text-[var(--crm-muted)]">{a.account_name ?? a.opportunity_name ?? '—'}</p>
                  </div>
                </li>
              );
            })}
            {!busy && todayTasks.length === 0 && (
              <li className="rounded-xl border border-dashed border-[var(--crm-line)] p-6 text-center text-sm text-[var(--crm-muted)]">
                {t('portal.crm.dash.no_tasks')}
              </li>
            )}
          </ul>
        </section>
      </div>

      {/* Cơ hội cần xử lý gấp */}
      <section className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <span className="material-symbols-outlined text-[20px] text-[#ff5625]">notifications_active</span>
          <h2 className="crm-display mr-auto text-[18px] font-medium text-[var(--crm-text)]">{t('portal.crm.dash.urgent')}</h2>
          {overdueCount > 0 && (
            <span className="rounded-full bg-[#f87171]/10 px-3 py-1 text-xs text-[#f87171]">
              {overdueCount} {t('portal.crm.dash.overdue')}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[var(--crm-s3)] text-[11px] uppercase tracking-[0.05em] text-[var(--crm-muted)]">
              <tr>
                <th className="px-5 py-3">{t('portal.crm.dash.col_opp')}</th>
                <th className="px-5 py-3">{t('portal.crm.dash.col_account')}</th>
                <th className="px-5 py-3 text-right">{t('portal.crm.dash.col_amount')}</th>
                <th className="px-5 py-3">{t('portal.crm.dash.col_stage')}</th>
                <th className="px-5 py-3 text-right">{t('portal.crm.dash.col_due')}</th>
              </tr>
            </thead>
            <tbody>
              {busy && (
                <tr><td colSpan={5} className="px-5 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</td></tr>
              )}
              {!busy && urgent.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.dash.no_urgent')}</td></tr>
              )}
              {urgent.map(({ row, left }) => (
                <tr key={row.id} className="border-t border-[var(--crm-line)]">
                  <td className="px-5 py-3 text-[var(--crm-text)]">
                    {row.name}
                    {row.code && <span className="ml-2 font-mono text-xs text-[var(--crm-muted)]">{row.code}</span>}
                  </td>
                  <td className="px-5 py-3 text-[var(--crm-muted)]">{row.account_name ?? '—'}</td>
                  <td className="crm-display px-5 py-3 text-right tabular-nums text-[var(--crm-text)]">{fmtVnd(Number(row.amount))}đ</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full border border-[#00daf3]/40 px-2.5 py-1 text-xs text-[#00daf3]">{row.stage_name}</span>
                  </td>
                  <td className={`px-5 py-3 text-right tabular-nums ${left < 0 ? 'text-[#f87171]' : 'text-[var(--crm-muted)]'}`}>
                    {left < 0
                      ? `${t('portal.crm.dash.late_by')} ${-left} ${t('portal.crm.dash.days')}`
                      : left === 0
                        ? t('portal.crm.dash.due_today')
                        : `${t('portal.crm.dash.in')} ${left} ${t('portal.crm.dash.days')}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PortalShell>
  );
}
