'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import {
  currentMonthVn, getCrmAccounts, getCrmActivities, getCrmBoard, getCrmKpiDeviceMonths,
  getCrmStages, getStaffPeers,
} from '@/lib/portal-queries';
import { staffPeriodStats, sumAmount, weightedForecast, type TeamPeriod } from '@/lib/crm-board';
import { PortalShell } from '@/components/portal/PortalShell';
import { CrmNav } from '@/components/portal/CrmNav';
import { SparklineBar } from '@/components/portal/SparklineBar';
import type {
  CrmAccountListRow, CrmActivityRow, CrmKpiDeviceMonth, CrmOpportunityBoardRow, CrmStage, StaffPeer,
} from '@/lib/portal-types';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const DAY_MS = 86_400_000;

/** Viết gọn tiền cho dòng chênh lệch: "29,5 tr" thay vì "29.500.000". */
function fmtShort(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  return new Intl.NumberFormat('vi-VN').format(Math.round(n));
}

/** Mũi tên tăng giảm so với kỳ liền trước; bằng nhau thì im lặng cho đỡ nhiễu. */
function Delta({ cur, prev, money = false }: { cur: number; prev: number; money?: boolean }) {
  if (cur === prev) return null;
  const up = cur > prev;
  const d = Math.abs(cur - prev);
  return (
    <span className={`block text-xs ${up ? 'text-[#ff8a50]' : 'text-[#f87171]'}`}>
      {up ? '▲' : '▼'} {money ? fmtShort(d) : d}
    </span>
  );
}

/** Số ngày từ hôm nay tới hạn đóng dự kiến. Âm là đã quá hạn. */
function daysLeft(dateStr: string, today: Date): number {
  const due = new Date(dateStr);
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((b - a) / DAY_MS);
}

/** Thời gian tương đối kiểu "2 phút trước" cho feed hoạt động. */
function relTime(ts: string, now: Date, t: (k: string) => string): string {
  const d = new Date(ts);
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return t('portal.crm.dash.just_now');
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} ${t('portal.crm.dash.min_ago')}`;
  const yesterday = new Date(now.getTime() - DAY_MS);
  if (d.toDateString() === now.toDateString()) {
    return `${Math.floor(diff / 3_600_000)} ${t('portal.crm.dash.hour_ago')}`;
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return `${t('portal.crm.dash.yesterday')}, ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Vòng progress ring: chu vi ≈100 nên strokeDasharray nhận thẳng số phần trăm. */
function ProgressRing({ pct, label }: { pct: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative h-12 w-12 shrink-0" role="img" aria-label={`${label}: ${clamped}%`}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--crm-s3)" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="15.9155" fill="none" stroke="#ff8a50" strokeWidth="3"
          strokeDasharray={`${clamped}, 100`} strokeLinecap="round"
          className="drop-shadow-[0_0_4px_rgba(255,138,80,0.6)]"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] tabular-nums text-[#ff8a50]">
        {clamped}%
      </span>
    </div>
  );
}

const KIND_ICON: Record<CrmActivityRow['kind'], string> = {
  task: 'task_alt',
  call: 'call',
  meeting: 'groups',
};

export default function CrmDashboardPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, profile, loading } = useAuth();
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [rows, setRows] = useState<CrmOpportunityBoardRow[]>([]);
  const [activities, setActivities] = useState<CrmActivityRow[]>([]);
  const [accounts, setAccounts] = useState<CrmAccountListRow[]>([]);
  const [kpiMonths, setKpiMonths] = useState<CrmKpiDeviceMonth[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  // Quản trị nhìn thấy dữ liệu của mọi nhân viên gộp lại, nên phải có danh sách
  // nhân viên để tách số liệu ra từng người và lọc cả trang theo một người.
  const [peers, setPeers] = useState<StaffPeer[]>([]);
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [period, setPeriod] = useState<TeamPeriod>('today');

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
      const [s, r, a, c, k] = await Promise.all([
        getCrmStages(),
        getCrmBoard(),
        getCrmActivities(),
        getCrmAccounts(),
        // Chỉ tiêu tháng cho vòng ring — RLS: nhân viên thấy của mình, admin cả đội.
        getCrmKpiDeviceMonths().catch(() => [] as CrmKpiDeviceMonth[]),
      ]);
      setStages(s);
      setRows(r);
      setActivities(a);
      setAccounts(c);
      setKpiMonths(k);
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

  // Số máy đã bán trong tháng dương lịch hiện tại: cộng quantity của các cơ hội
  // thắng có mốc đóng sổ closed_at rơi vào tháng này.
  const machinesThisMonth = useMemo(() => {
    return fRows
      .filter(r => {
        if (r.forecast !== 'won' || !r.closed_at) return false;
        const d = new Date(r.closed_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  }, [fRows, now]);

  // Chỉ tiêu máy tháng này: lọc theo nhân viên đang chọn; "tất cả" thì cộng
  // chỉ tiêu mọi người nhìn thấy được (staff = của mình, admin = cả đội).
  const kpiTarget = useMemo(() => {
    const month = currentMonthVn();
    return kpiMonths
      .filter(m => m.thang === month && (staffFilter === 'all' || m.staff_id === staffFilter))
      .reduce((s, m) => s + (Number(m.kpi_target) || 0), 0);
  }, [kpiMonths, staffFilter]);
  const targetPct = kpiTarget > 0 ? Math.round((machinesThisMonth / kpiTarget) * 100) : 0;

  // Hoa hồng tạm tính = tổng hoa hồng dự kiến của các cơ hội đang mở,
  // cùng công thức với cột "Hoa hồng dự kiến" trong bảng nhân viên.
  const commissionOpen = useMemo(
    () => openRows.reduce((s, r) => s + Number(r.expected_commission), 0),
    [openRows],
  );

  // Sparkline khách mới: 10 khoảng × 3 ngày trong 30 ngày gần nhất.
  const accountSpark = useMemo(() => {
    const buckets = new Array<number>(10).fill(0);
    const from = now.getTime() - 30 * DAY_MS;
    for (const a of fAccounts) {
      const ts = new Date(a.created_at).getTime();
      if (ts < from) continue;
      buckets[Math.min(9, Math.floor((ts - from) / (3 * DAY_MS)))] += 1;
    }
    return buckets;
  }, [fAccounts, now]);

  // Bảng so sánh cho quản trị: tính từ dữ liệu CHƯA lọc để mọi dòng luôn đủ,
  // kể cả khi đang lọc trang theo một người. Ăn theo nhịp `now` nên các cửa sổ
  // hôm nay / 7 ngày / 30 ngày tự trượt theo đồng hồ.
  const teamStats = useMemo(() => {
    if (!isAdmin) return [];
    return peers.map(p => ({
      peer: p,
      ...staffPeriodStats(p.id, rows, accounts, activities, period, now),
    }));
  }, [isAdmin, peers, rows, accounts, activities, period, now]);

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

  // Feed hoạt động gần đây: xếp theo mốc mới nhất (xong lúc nào, hoặc tạo lúc nào).
  const recentFeed = useMemo(() => {
    return fActivities
      .map(a => ({ a, ts: a.done_at ?? a.created_at }))
      .sort((x, y) => y.ts.localeCompare(x.ts))
      .slice(0, 6);
  }, [fActivities]);

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
  const heroCard = `${card} p-5 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[var(--crm-s2)]`;
  const iconChip = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--crm-s3)]';
  const capsLabel = 'text-[11px] uppercase tracking-[0.05em] text-[var(--crm-muted)]';

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
            className="rounded-xl border border-[var(--crm-line)] bg-[var(--crm-s1)] px-3 py-2 text-sm text-[var(--crm-text)] outline-none [color-scheme:dark] focus:border-[#ff8a50]"
          >
            <option value="all">{t('portal.crm.dash.staff_all')}</option>
            {peers.map(p => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.email}{p.staff_segment ? ` · ${t('portal.crm.segment.' + p.staff_segment)}` : ''}
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
            <span className="material-symbols-outlined text-[20px] text-[#ffb77d]">groups</span>
            <h2 className="crm-display mr-auto text-[18px] font-medium text-[var(--crm-text)]">
              {t('portal.crm.dash.team_title')}
            </h2>
            <div className="flex rounded-xl bg-[var(--crm-s3)] p-1 text-xs">
              {(['today', '7d', '30d'] as TeamPeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-lg px-3 py-1.5 ${period === p
                    ? 'bg-[#e8692a] font-bold text-white'
                    : 'text-[var(--crm-muted)] hover:text-[var(--crm-text)]'}`}
                >
                  {t('portal.crm.dash.period_' + p)}
                </button>
              ))}
            </div>
            <span className="text-xs text-[var(--crm-muted)]">
              {t('portal.crm.dash.vs_prev')} · {t('portal.crm.dash.team_hint')}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-[var(--crm-s3)] text-[11px] uppercase tracking-[0.05em] text-[var(--crm-muted)]">
                <tr>
                  <th className="px-5 py-3">{t('portal.crm.reports.col_staff')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.reports.col_accounts')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.reports.col_new_accounts')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.reports.col_won')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.reports.col_won_value')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.dash.col_done_tasks')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.pipeline.open_count')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.pipeline.open_value')}</th>
                  <th className="px-5 py-3 text-right">{t('portal.crm.opp.expected_commission')}</th>
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
                      staffFilter === s.peer.id ? 'bg-[#ff8a50]/10' : ''
                    }`}
                  >
                    <td className="px-5 py-3 text-[var(--crm-text)]">
                      {s.peer.full_name || s.peer.email}
                      {s.peer.staff_segment && (
                        <span className="ml-2 rounded-full bg-[var(--crm-s3)] px-2 py-0.5 text-xs text-[var(--crm-muted)]">
                          {t('portal.crm.segment.' + s.peer.staff_segment)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-[var(--crm-text)]">{s.totalAccounts}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[var(--crm-text)]">
                      {s.newAccounts}
                      <Delta cur={s.newAccounts} prev={s.newAccountsPrev} />
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#ff8a50]">
                      {s.wonDeals}
                      <Delta cur={s.wonDeals} prev={s.wonDealsPrev} />
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-[var(--crm-text)]">
                      {fmtVnd(s.wonValue)}đ
                      <Delta cur={s.wonValue} prev={s.wonValuePrev} money />
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-[var(--crm-text)]">
                      {s.doneTasks}
                      <Delta cur={s.doneTasks} prev={s.doneTasksPrev} />
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-[var(--crm-text)]">{s.openCount}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-[var(--crm-text)]">{fmtVnd(s.openValue)}đ</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-[#ffb77d]">{fmtVnd(s.expectedCommission)}đ</td>
                    <td className={`px-5 py-3 text-right tabular-nums ${s.overdueTasks > 0 ? 'text-[#f87171]' : 'text-[var(--crm-muted)]'}`}>
                      {s.overdueTasks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 1. Hàng hero: 4 thẻ chỉ số chính */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Máy bán tháng này + vòng tỉ lệ chốt */}
        <div className={heroCard}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <p className={capsLabel}>{t('portal.crm.dash.machines_month')}</p>
            <span className={iconChip}>
              <span className="material-symbols-outlined text-[20px] text-[#ff8a50]">precision_manufacturing</span>
            </span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <p className="crm-display text-4xl font-semibold tabular-nums text-[#ff8a50]">
              {machinesThisMonth}
              <span className="ml-1 text-base font-normal text-[var(--crm-muted)]">
                {kpiTarget > 0 ? `/ ${kpiTarget} ` : ''}{t('portal.crm.dash.machines_unit')}
              </span>
            </p>
            <ProgressRing pct={targetPct} label={t('portal.crm.dash.target_progress')} />
          </div>
          <p className="mt-4 font-mono text-xs tabular-nums text-[var(--crm-muted)]">
            {t('portal.crm.dash.win_rate')} {winRate}% ·{' '}
            <span className="text-[#ff8a50]">{wonCount} {t('portal.crm.dash.won')}</span> ·{' '}
            <span className="text-[#f87171]">{lostCount} {t('portal.crm.dash.lost')}</span>
          </p>
        </div>

        {/* Khách hàng mới + sparkline 30 ngày */}
        <div className={heroCard}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <p className={capsLabel}>{t('portal.crm.dash.new_accounts')}</p>
            <span className={iconChip}>
              <span className="material-symbols-outlined text-[20px] text-[#ff8a50]">person_add</span>
            </span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <p className="crm-display text-4xl font-semibold tabular-nums text-[var(--crm-text)]">{newAccounts}</p>
            <div className="mb-1">
              <SparklineBar data={accountSpark} width={96} height={36} gap={3} />
            </div>
          </div>
          <p className="mt-4 font-mono text-xs tabular-nums text-[var(--crm-muted)]">
            {t('portal.crm.dash.last_30_days')} · {t('portal.crm.dash.total')}: {fAccounts.length}
          </p>
        </div>

        {/* Hoa hồng tạm tính — accent vàng */}
        <div className={heroCard}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <p className={capsLabel}>{t('portal.crm.dash.commission_est')}</p>
            <span className={iconChip}>
              <span className="material-symbols-outlined text-[20px] text-[#ffb77d]">payments</span>
            </span>
          </div>
          <p className="crm-display text-3xl font-semibold tracking-tight tabular-nums text-[#ffb77d]">
            {fmtVnd(commissionOpen)}<span className="ml-0.5 text-xl">₫</span>
          </p>
          <p className="mt-4 font-mono text-xs tabular-nums text-[var(--crm-muted)]">
            {t('portal.crm.opp.expected_commission')} · {openRows.length} {t('portal.crm.dash.open_deals_count')}
          </p>
        </div>

        {/* Giá trị đang mở + dự báo */}
        <div className={heroCard}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <p className={capsLabel}>{t('portal.crm.dash.open_value')}</p>
            <span className={iconChip}>
              <span className="material-symbols-outlined text-[20px] text-[#ff8a50]">trending_up</span>
            </span>
          </div>
          <p className="crm-display text-3xl font-semibold tracking-tight tabular-nums text-[var(--crm-text)]">
            {fmtVnd(sumAmount(openRows))}<span className="ml-0.5 text-xl text-[var(--crm-muted)]">₫</span>
          </p>
          <p className="mt-4 font-mono text-xs tabular-nums text-[var(--crm-muted)]">
            {t('portal.crm.pipeline.forecast')}:{' '}
            <span className="text-[#ffb77d]">{fmtVnd(weightedForecast(openRows))}đ</span>
            {' '}· {t('portal.crm.dash.deals_open')}: {openRows.length}
          </p>
        </div>
      </div>

      {/* 2. Phễu pipeline + hoạt động gần đây + việc hôm nay */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {/* Phễu chuyển đổi */}
        <section className={`${card} flex flex-col p-5 lg:col-span-1`}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="crm-display text-[18px] font-medium text-[var(--crm-text)]">{t('portal.crm.dash.funnel')}</h2>
            <Link href="/portal/crm/pipeline" className="text-xs text-[#ffb77d] hover:underline">
              {t('portal.crm.dash.view_all')}
            </Link>
          </div>
          {busy && <p className="text-sm text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</p>}
          {!busy && funnel.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--crm-muted)]">{t('portal.crm.dash.empty')}</p>
          )}
          <div className="flex flex-1 flex-col justify-between gap-3">
            {funnel.map((step, i) => {
              const isWon = step.stage.forecast === 'won';
              const depth = funnel.length > 1 ? i / (funnel.length - 1) : 1;
              return (
                <div key={step.stage.id} className="flex items-center gap-3">
                  <span className={`crm-display w-10 shrink-0 text-right text-sm tabular-nums ${isWon ? 'text-[#ffb77d]' : 'text-[var(--crm-text)]'}`}>
                    {step.count}
                  </span>
                  <div className={`relative h-8 flex-1 overflow-hidden rounded-lg border bg-[var(--crm-s3)] ${isWon ? 'border-[#ffb77d]/30' : 'border-[var(--crm-line)]/60'}`}>
                    <div
                      className="absolute left-0 top-0 h-full rounded-lg"
                      style={{
                        width: `${step.width}%`,
                        backgroundColor: isWon ? '#d97706' : '#e8692a',
                        opacity: isWon ? 1 : 0.45 + depth * 0.55,
                      }}
                    />
                    <span className="absolute inset-0 flex items-center truncate px-3 text-xs text-[var(--crm-text)]">
                      {step.stage.name}
                    </span>
                  </div>
                  <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-[var(--crm-muted)]">
                    {step.keepPct !== null ? `${step.keepPct}%` : '—'}
                  </span>
                </div>
              );
            })}
            {!busy && funnel.length > 0 && (
              <div className="mt-1 flex items-center gap-3 border-t border-[var(--crm-line)]/60 pt-3 opacity-60">
                <span className="crm-display w-10 shrink-0 text-right text-sm tabular-nums text-[var(--crm-muted)]">{lostCount}</span>
                <div className="relative h-6 flex-1 overflow-hidden rounded-lg border border-[var(--crm-line)]/60 bg-[var(--crm-s2)]">
                  <span className="absolute inset-0 flex items-center truncate px-3 text-xs text-[var(--crm-muted)]">
                    {t('portal.crm.dash.lost')}
                  </span>
                </div>
                <span className="w-9 shrink-0" />
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 lg:col-span-2">
          {/* Hoạt động gần đây — timeline chấm tròn */}
          <section className={`${card} flex flex-col p-5`}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="crm-display text-[18px] font-medium text-[var(--crm-text)]">{t('portal.crm.dash.recent_activity')}</h2>
              <Link href="/portal/crm/activities" className="text-xs text-[#ffb77d] hover:underline">
                {t('portal.crm.dash.view_all')}
              </Link>
            </div>
            {busy && <p className="text-sm text-[var(--crm-muted)]">{t('portal.crm.common.loading')}</p>}
            {!busy && recentFeed.length === 0 && (
              <p className="rounded-xl border border-dashed border-[var(--crm-line)] p-6 text-center text-sm text-[var(--crm-muted)]">
                {t('portal.crm.dash.no_activity')}
              </p>
            )}
            {recentFeed.length > 0 && (
              <div className="relative space-y-5">
                <div aria-hidden="true" className="absolute bottom-2 left-[11px] top-2 w-px bg-[var(--crm-line)]/60" />
                {recentFeed.map(({ a, ts }) => {
                  const done = Boolean(a.done_at);
                  return (
                    <div key={a.id} className="relative z-10 flex gap-3">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          done
                            ? 'border-[#ff8a50]/50 bg-[#e8692a]'
                            : 'border-[var(--crm-line)] bg-[var(--crm-s3)]'
                        }`}
                      >
                        <span className={`material-symbols-outlined text-[13px] ${done ? 'text-[#ff8a50]' : 'text-[var(--crm-muted)]'}`}>
                          {KIND_ICON[a.kind]}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-[var(--crm-text)]">
                          {a.subject}
                          {(a.account_name ?? a.opportunity_name) && (
                            <span className="text-[#ff8a50]"> · {a.account_name ?? a.opportunity_name}</span>
                          )}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--crm-muted)]">
                          {t('portal.crm.activity.kind_' + a.kind)} · {relTime(ts, now, t)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Việc cần làm hôm nay */}
          <section className={`${card} flex flex-col p-5`}>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <h2 className="crm-display mr-auto text-[18px] font-medium text-[var(--crm-text)]">{t('portal.crm.dash.today_tasks')}</h2>
              {lateTaskCount > 0 && (
                <span className="rounded-full bg-[#f87171]/10 px-3 py-1 text-xs text-[#f87171]">
                  {lateTaskCount} {t('portal.crm.dash.overdue')}
                </span>
              )}
              <Link href="/portal/crm/activities" className="text-xs text-[#ffb77d] hover:underline">
                {t('portal.crm.dash.view_all')}
              </Link>
            </div>
            <ul className="space-y-2.5">
              {todayTasks.map(a => {
                const due = a.due_at ? new Date(a.due_at) : null;
                const late = due ? due < now : false;
                // Việc trễ từ hôm trước phải hiện cả ngày — chỉ in "09:00" đỏ thì
                // không ai biết nó trễ từ bao giờ.
                const sameDay = due ? due.toDateString() === now.toDateString() : true;
                return (
                  <li
                    key={a.id}
                    className={`flex items-start gap-3 rounded-xl border bg-[var(--crm-s2)] p-3 transition-colors hover:bg-[var(--crm-s3)] ${
                      late ? 'border-[#f87171]/30' : 'border-[var(--crm-line)]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${late ? 'border-[#f87171]/60' : 'border-[var(--crm-line)]'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${late ? 'text-[#f87171]' : 'text-[var(--crm-text)]'}`}>{a.subject}</p>
                      <p className="truncate text-xs text-[var(--crm-muted)]">{a.account_name ?? a.opportunity_name ?? '—'}</p>
                    </div>
                    <span className={`crm-display shrink-0 text-sm tabular-nums ${late ? 'text-[#f87171]' : 'text-[#ff8a50]'}`}>
                      {due
                        ? sameDay
                          ? due.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                          : due.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </span>
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
      </div>

      {/* Cơ hội cần xử lý gấp */}
      <section className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <span className="material-symbols-outlined text-[20px] text-[#ff8a50]">notifications_active</span>
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
                    <span className="rounded-full border border-[#ffb77d]/40 px-2.5 py-1 text-xs text-[#ffb77d]">{row.stage_name}</span>
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
