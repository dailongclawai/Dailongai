import type { CrmActivityRow, CrmAccountListRow, CrmOpportunityBoardRow, CrmStage } from './portal-types';

/** Tiền tố tên cơ hội tự sinh — cố định tiếng Việt bất kể ngôn ngữ giao diện,
 *  để dữ liệu trong DB đồng nhất (Boss chốt 02/08/2026). */
export const OPP_NAME_PREFIX = 'Đơn máy';

export interface BoardColumn {
  stage: CrmStage;
  rows: CrmOpportunityBoardRow[];
}

export function groupByStage(
  stages: CrmStage[],
  rows: CrmOpportunityBoardRow[],
): BoardColumn[] {
  return [...stages]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(stage => ({ stage, rows: rows.filter(r => r.stage_id === stage.id) }));
}

export function sumAmount(rows: CrmOpportunityBoardRow[]): number {
  return rows.reduce((acc, r) => acc + Number(r.amount), 0);
}

export function weightedForecast(rows: CrmOpportunityBoardRow[]): number {
  return rows.reduce((acc, r) => acc + (Number(r.amount) * r.probability) / 100, 0);
}

// ── Số liệu từng nhân viên theo kỳ, cho bảng so sánh trên Tổng quan ──

export type TeamPeriod = 'today' | '7d' | '30d';

export interface StaffPeriodStats {
  /** Trong kỳ đã chọn / kỳ liền trước cùng độ dài. */
  newAccounts: number;
  newAccountsPrev: number;
  wonDeals: number;
  wonDealsPrev: number;
  wonValue: number;
  wonValuePrev: number;
  doneTasks: number;
  doneTasksPrev: number;
  /** Tại thời điểm hiện tại, không phụ thuộc kỳ. */
  totalAccounts: number;
  openCount: number;
  openValue: number;
  expectedCommission: number;
  overdueTasks: number;
}

/** Kỳ "hôm nay" đo từ 0h (kỳ trước = trọn hôm qua); 7/30 ngày đo lùi từ bây giờ
 *  (kỳ trước = 7/30 ngày liền kề trước đó). Deal tính theo mốc đóng sổ closed_at,
 *  khách theo created_at, việc theo done_at. */
export function staffPeriodStats(
  staffId: string,
  rows: CrmOpportunityBoardRow[],
  accounts: Pick<CrmAccountListRow, 'owner_id' | 'created_at'>[],
  activities: Pick<CrmActivityRow, 'owner_id' | 'done_at' | 'due_at'>[],
  period: TeamPeriod,
  now: Date,
): StaffPeriodStats {
  const DAY = 86_400_000;
  const nowMs = now.getTime();
  let curStart: number;
  let span: number;
  if (period === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    curStart = d.getTime();
    span = DAY;
  } else {
    span = (period === '7d' ? 7 : 30) * DAY;
    curStart = nowMs - span;
  }
  const prevStart = curStart - span;

  const inCur = (ts: string | null) => {
    if (!ts) return false;
    const v = new Date(ts).getTime();
    return v >= curStart && v <= nowMs;
  };
  const inPrev = (ts: string | null) => {
    if (!ts) return false;
    const v = new Date(ts).getTime();
    return v >= prevStart && v < curStart;
  };

  const myRows = rows.filter(r => r.owner_id === staffId);
  const open = myRows.filter(r => r.forecast === 'open');
  const won = myRows.filter(r => r.forecast === 'won');
  const myAccounts = accounts.filter(a => a.owner_id === staffId);
  const myActs = activities.filter(a => a.owner_id === staffId);
  const wonCur = won.filter(r => inCur(r.closed_at));
  const wonPrev = won.filter(r => inPrev(r.closed_at));

  return {
    newAccounts: myAccounts.filter(a => inCur(a.created_at)).length,
    newAccountsPrev: myAccounts.filter(a => inPrev(a.created_at)).length,
    wonDeals: wonCur.length,
    wonDealsPrev: wonPrev.length,
    wonValue: sumAmount(wonCur),
    wonValuePrev: sumAmount(wonPrev),
    doneTasks: myActs.filter(a => inCur(a.done_at)).length,
    doneTasksPrev: myActs.filter(a => inPrev(a.done_at)).length,
    totalAccounts: myAccounts.length,
    openCount: open.length,
    openValue: sumAmount(open),
    expectedCommission: open.reduce((s, r) => s + Number(r.expected_commission), 0),
    overdueTasks: myActs.filter(a => !a.done_at && a.due_at && new Date(a.due_at).getTime() < nowMs).length,
  };
}
