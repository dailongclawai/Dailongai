'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { getCrmAccounts, getCrmActivities, getCrmBoard, getCrmStages, getStaffPeers } from '@/lib/portal-queries';
import { sumAmount, weightedForecast } from '@/lib/crm-board';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import type {
  CrmAccountListRow, CrmActivityRow, CrmOpportunityBoardRow, CrmStage, StaffPeer,
} from '@/lib/portal-types';

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
  // Quản trị nhìn thấy dữ liệu của mọi nhân viên gộp lại, nên phải có danh sách
  // nhân viên để tách số liệu ra từng người và lọc cả trang theo một người.
  const [peers, setPeers] = useState<StaffPeer[]>([]);
  const [staffFilter, setStaffFilter] = useState<string>('all');

  const isAdmin = profile?.role === 'admin';

  // Nhịp mỗi phút: các mốc "trễ / hôm nay / còn X ngày" tự nhảy theo đồng hồ.
  // Không có nó, trang mở từ sáng tới chiều vẫn nói "đến hạn hôm nay" dù đã trễ.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

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

  useEffect(() => {
    if (!session || !isAdmin) return;
    void getStaffPeers()
      .then(ps => setPeers(ps.filter(p => p.role === 'staff')))
      .catch(() => setPeers([]));
  }, [session, isAdmin]);

  // Ba nguồn dữ liệu đều mang owner_id, nên lọc theo nhân viên làm ngay tại
  // trình duyệt — không cần gọi lại máy chủ.
  const fRows = useMemo(
    () => (staffFilter === 'all' ? rows : rows.filter(r => r.owner_id === staffFilter)),
    [rows, staffFilter],
  );
  const fActivities = useMemo(
    () => (staffFilter === 'all' ? activities : activities.filter(a => a.owner_id === staffFilter)),
    [activities, staffFilter],
  );
  const fAccounts = useMemo(
    () => (staffFilter === 'all' ? accounts : accounts.filter(a => a.owner_id === staffFilter)),
    [accounts, staffFilter],
  );

  const openRows = useMemo(() => fRows.filter(r => r.forecast === 'open'), [fRows]);
  const wonCount = useMemo(() => fRows.filter(r => r.forecast === 'won').length, [fRows]);
  const lostCount = useMemo(() => fRows.filter(r => r.forecast === 'lost').length, [fRows]);
  const closedCount = wonCount + lostCount;
  const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 1000) / 10 : 0;

  const newAccounts = useMemo(() => {
    const from = Date.now() - 30 * DAY_MS;
    return fAccounts.filter(a => new Date(a.created_at).getTime() >= from).length;
  }, [fAccounts]);

  // Bảng so sánh cho quản trị: tính từ dữ liệu CHƯA lọc để mọi dòng luôn đủ,
  // kể cả khi đang lọc trang theo một người.
  const teamStats = useMemo(() => {
    if (!isAdmin) return [];
    const now = Date.now();
    const from30 = now - 30 * DAY_MS;
    return peers.map(p => {
      const myRows = rows.filter(r => r.owner_id === p.id);
      const open = myRows.filter(r => r.forecast === 'open');
      const won = myRows.filter(r => r.forecast === 'won').length;
      const lost = myRows.filter(r => r.forecast === 'lost').length;
      const closed = won + lost;
      const myAccounts = accounts.filter(a => a.owner_id === p.id);
      return {
        peer: p,
        accounts: myAccounts.length,
        new30: myAccounts.filter(a => new Date(a.created_at).getTime() >= from30).length,
        openCount: open.length,
        openValue: sumAmount(open),
        forecast: weightedForecast(open),
        expectedCommission: open.reduce((s, r) => s + Number(r.expected_commission), 0),
        won,
        lost,
        winRate: closed > 0 ? Math.round((won / closed) * 1000) / 10 : 0,
        overdue: activities.filter(a =>
          a.owner_id === p.id && !a.done_at && a.due_at && new Date(a.due_at).getTime() < now).length,
      };
    });
  }, [isAdmin, peers, rows, accounts, activities]);

  // Phễu: mỗi bậc đếm số cơ hội đã đi qua bậc đó (đang ở bậc này hoặc xa hơn).
  // Cơ hội thua bị loại vì chúng rơi khỏi chuỗi chứ không đi tiếp.
  const funnel = useMemo(() => {
    const order = new Map(stages.map(s => [s.id, s.sort_order]));
    const alive = fRows.filter(r => r.forecast !== 'lost');
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
  }, [stages, fRows]);

  // Việc quá hạn và việc tới hạn hôm nay, sớm nhất lên trước.
  const todayTasks = useMemo(() => {
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    return fActivities
      .filter(a => !a.done_at && a.due_at && new Date(a.due_at) <= endOfToday)
      .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
      .slice(0, 5);
  }, [fActivities, now]);

  // Đếm trên toàn bộ danh sách chứ không trên 5 dòng đang hiện, để badge nói
  // đúng tổng số việc trễ.
  const lateTaskCount = useMemo(
    () => fActivities.filter(a => !a.done_at && a.due_at && new Date(a.due_at) < now).length,
    [fActivities, now],
  );

  // Cơ hội đang mở tới hạn đóng trong 7 ngày tới hoặc đã quá hạn.
  const urgent = useMemo(() => {
    return openRows
      .map(r => ({ row: r, left: daysLeft(r.expected_close_date, now) }))
      .filter(x => x.left <= 7)
      .sort((a, b) => a.left - b.left)
      .slice(0, 6);
  }, [openRows, now]);

  const overdueCount = urgent.filter(x => x.left < 0).length;

  if (loading || !profile) return null;

  const card = 'rounded-2xl border border-[var(--crm-line)] bg-[var(--crm-s1)]';

  return (
    <PortalShell variant={profile.role ?? 'dealer'}>
      <CrmNav />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="crm-display text-xl font-semibold text-[var(--crm-text)]">{t('portal.crm.dash.title')}</h1>
          <p className="mt-1 text-xs text-[var(--crm-muted)]">
            {busy ? t('portal.crm.common.loading') : `${t('portal.crm.dash.updated')} ${loadedAt ?? ''}`}
          </p>
        </div>
        {isAdmin && peers.length > 0 && (
          <select
            aria-label={t('portal.crm.dash.staff_filter')}
            value={staffFilter}
            onChange={e => setStaffFilter(e.target.value)}
            className="rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s1)] px-3 py-2 text-sm text-[var(--crm-text)] outline-none [color-scheme:dark] focus:border-[#ff5625]"
          >
            <option value="all">{t('portal.crm.dash.staff_all')}</option>
            {peers.map(p => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.email}{p.staff_segment ? ` · ${p.staff_segment.toUpperCase()}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Bảng số liệu từng nhân viên — chỉ quản trị. Tính từ dữ liệu chưa lọc
          nên vẫn đủ mọi dòng khi trang đang lọc theo một người. */}
      {isAdmin && (
        <section className={`${card} mb-6 overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-3 px-5 py-4">
            <span className="material-symbols-outlined text-[20px] text-[#00daf3]">groups</span>
            <h2 className="crm-display mr-auto text-[18px] font-medium text-[var(--crm-text)]">
              {t('portal.crm.dash.team_title')}
            </h2>
            <span className="text-xs text-[var(--crm-muted)]">{t('portal.crm.dash.team_hint')}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-[var(--crm-s3)] text-[11px] uppercase tracking-[0.05em] text-[var(--crm-muted)]">
                <tr>
                  <th className="px-5 py-3">{t('portal.crm.reports.col_staff')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.reports.col_accounts')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.dash.col_new30')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.pipeline.open_count')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.pipeline.open_value')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.pipeline.forecast')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.opp.expected_commission')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.dash.won_lost')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.dash.win_rate')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.dash.col_overdue_tasks')}</th>
                </tr>
              </thead>
              <tbody>
                {busy && (
                  <tr><td colSpan={10} className="px-5 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</td></tr>
                )}
                {!busy && teamStats.length === 0 && (
                  <tr><td colSpan={10} className="px-5 py-6 text-center text-[var(--crm-muted)]">{t('portal.crm.reports.empty')}</td></tr>
                )}
                {teamStats.map(s => (
                  <tr
                    key={s.peer.id}
                    onClick={() => setStaffFilter(f => (f === s.peer.id ? 'all' : s.peer.id))}
                    className={`cursor-pointer border-t border-[var(--crm-line)] hover:bg-[var(--crm-s3)] ${
                      staffFilter === s.peer.id ? 'bg-[#ff5625]/10' : ''
                    }`}
                  >
                    <td className="px-5 py-3 text-[var(--crm-text)]">
                      {s.peer.full_name || s.peer.email}
                      {s.peer.staff_segment && (
                        <span className="ml-2 rounded-full bg-[var(--crm-s3)] px-2 py-0.5 text-xs text-[var(--crm-muted)]">
                          {s.peer.staff_segment.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-[var(--crm-text)]">{s.accounts}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[var(--crm-muted)]">{s.new30}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[var(--crm-text)]">{s.openCount}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-[var(--crm-text)]">{fmtVnd(s.openValue)}đ</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-[#00daf3]">{fmtVnd(s.forecast)}đ</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-[#00daf3]">{fmtVnd(s.expectedCommission)}đ</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span className="text-[#34d399]">{s.won}</span>
                      <span className="text-[var(--crm-muted)]"> / </span>
                      <span className="text-[#f87171]">{s.lost}</span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-[var(--crm-text)]">{s.winRate}%</td>
                    <td className={`px-5 py-3 text-right tabular-nums ${s.overdue > 0 ? 'text-[#f87171]' : 'text-[var(--crm-muted)]'}`}>
                      {s.overdue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
              {t('portal.crm.dash.total')}: {fAccounts.length}
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
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="crm-display mr-auto text-[18px] font-medium text-[var(--crm-text)]">{t('portal.crm.dash.today_tasks')}</h2>
            {lateTaskCount > 0 && (
              <span className="rounded-full bg-[#f87171]/10 px-3 py-1 text-xs text-[#f87171]">
                {lateTaskCount} {t('portal.crm.dash.overdue')}
              </span>
            )}
            <Link href="/portal/crm/activities" className="text-xs text-[#00daf3] hover:underline">
              {t('portal.crm.dash.view_all')}
            </Link>
          </div>
          <ul className="space-y-2">
            {todayTasks.map(a => {
              const due = a.due_at ? new Date(a.due_at) : null;
              const late = due ? due < now : false;
              // Việc trễ từ hôm trước phải hiện cả ngày — chỉ in "09:00" đỏ thì
              // không ai biết nó trễ từ bao giờ.
              const sameDay = due ? due.toDateString() === now.toDateString() : true;
              return (
                <li key={a.id} className="flex gap-3 rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s2)] p-3">
                  <span className={`crm-display shrink-0 text-sm tabular-nums ${late ? 'text-[#f87171]' : 'text-[#ff5625]'}`}>
                    {due
                      ? sameDay
                        ? due.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                        : due.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : '—'}
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
