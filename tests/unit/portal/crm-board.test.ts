import { describe, it, expect } from 'vitest';
import { groupByStage, staffPeriodStats, sumAmount, weightedForecast } from '@/lib/crm-board';
import type { CrmOpportunityBoardRow, CrmStage } from '@/lib/portal-types';

const stages: CrmStage[] = [
  { id: 's1', name: 'Mới tiếp nhận', probability: 10, forecast: 'open', sort_order: 1, active: true },
  { id: 's2', name: 'Đang quan tâm', probability: 30, forecast: 'open', sort_order: 2, active: true },
  { id: 's3', name: 'Hoàn thành đơn', probability: 100, forecast: 'won', sort_order: 3, active: true },
];

const row = (id: string, stage_id: string, amount: number, probability: number): CrmOpportunityBoardRow => ({
  id, code: 'CH-000001', name: 'opp ' + id, stage_id,
  stage_name: 'x', probability, forecast: 'open', sort_order: 1, amount, quantity: 1,
  trial_days: null, expected_commission: String(amount * 0.1),
  expected_close_date: '2026-08-10', owner_id: 'o1', owner_name: null,
  account_id: 'a1', account_name: 'Cô Lan', account_phone: null, account_kind: 'customer',
  contact_id: null, model_id: null, order_id: null, closed_at: null,
  lost_reason_id: null, lost_reason_name: null, lost_notes: null,
  created_at: '2026-07-27T00:00:00Z', notes: null,
});

describe('groupByStage', () => {
  it('returns one column per stage, in sort order', () => {
    const cols = groupByStage(stages, [row('1', 's2', 100, 30)]);
    expect(cols.map(c => c.stage.id)).toEqual(['s1', 's2', 's3']);
    expect(cols[0].rows).toHaveLength(0);
    expect(cols[1].rows.map(r => r.id)).toEqual(['1']);
  });

  it('xếp cơ hội vào đúng cột theo stage_id', () => {
    const cols = groupByStage(stages, [row('1', 's3', 100, 100)]);
    expect(cols[2].rows.map(r => r.id)).toEqual(['1']);
    expect(cols[0].rows).toHaveLength(0);
  });
});

describe('sumAmount', () => {
  it('sums the amount column', () => {
    expect(sumAmount([row('1', 's1', 100, 10), row('2', 's1', 250, 10)])).toBe(350);
  });
});

describe('weightedForecast', () => {
  it('weights each amount by its stage probability', () => {
    expect(weightedForecast([row('1', 's1', 1000, 10), row('2', 's2', 1000, 30)])).toBe(400);
  });
});

describe('staffPeriodStats', () => {
  // 10h sáng 01/08 giờ VN làm mốc "bây giờ" cho mọi kịch bản.
  const now = new Date('2026-08-01T10:00:00+07:00');
  const at = (iso: string) => new Date(iso).toISOString();

  const wonRow = (id: string, closedAt: string, amount: number): CrmOpportunityBoardRow => ({
    ...row(id, 's3', amount, 100),
    forecast: 'won',
    closed_at: at(closedAt),
  });

  const rows: CrmOpportunityBoardRow[] = [
    row('open1', 's1', 50_000_000, 10),                                  // đang mở
    wonRow('w-today', '2026-08-01T08:00:00+07:00', 29_500_000),          // chốt sáng nay
    wonRow('w-yesterday', '2026-07-31T15:00:00+07:00', 59_000_000),      // chốt hôm qua
    wonRow('w-20d', '2026-07-12T09:00:00+07:00', 88_500_000),            // chốt 20 ngày trước
    { ...wonRow('w-other-staff', '2026-08-01T09:00:00+07:00', 10_000_000), owner_id: 'o2' },
  ];
  const accounts = [
    { owner_id: 'o1', created_at: at('2026-08-01T07:00:00+07:00') },     // hôm nay
    { owner_id: 'o1', created_at: at('2026-07-31T10:00:00+07:00') },     // hôm qua
    { owner_id: 'o1', created_at: at('2026-07-05T10:00:00+07:00') },     // 27 ngày trước
    { owner_id: 'o2', created_at: at('2026-08-01T08:00:00+07:00') },     // của người khác
  ];
  const activities = [
    { owner_id: 'o1', done_at: at('2026-08-01T09:00:00+07:00'), due_at: null },          // xong hôm nay
    { owner_id: 'o1', done_at: at('2026-07-30T09:00:00+07:00'), due_at: null },          // xong 2 ngày trước
    { owner_id: 'o1', done_at: null, due_at: at('2026-07-31T09:00:00+07:00') },          // quá hạn chưa xong
    { owner_id: 'o1', done_at: null, due_at: at('2026-08-09T09:00:00+07:00') },          // còn hạn
  ];

  it('kỳ hôm nay so với trọn hôm qua', () => {
    const s = staffPeriodStats('o1', rows, accounts, activities, 'today', now);
    expect(s.newAccounts).toBe(1);
    expect(s.newAccountsPrev).toBe(1);
    expect(s.wonDeals).toBe(1);
    expect(s.wonDealsPrev).toBe(1);
    expect(s.wonValue).toBe(29_500_000);
    expect(s.wonValuePrev).toBe(59_000_000);
    expect(s.doneTasks).toBe(1);
    expect(s.doneTasksPrev).toBe(0);
  });

  it('kỳ 7 ngày gộp hôm nay lẫn hôm qua, kỳ trước bắt deal 20 ngày không dính', () => {
    const s = staffPeriodStats('o1', rows, accounts, activities, '7d', now);
    expect(s.wonDeals).toBe(2);
    expect(s.wonValue).toBe(88_500_000);
    expect(s.wonDealsPrev).toBe(0);
    expect(s.newAccounts).toBe(2);
    expect(s.doneTasks).toBe(2);
  });

  it('kỳ 30 ngày ôm cả deal 20 ngày trước và khách 27 ngày trước', () => {
    const s = staffPeriodStats('o1', rows, accounts, activities, '30d', now);
    expect(s.wonDeals).toBe(3);
    expect(s.wonValue).toBe(177_000_000);
    expect(s.newAccounts).toBe(3);
  });

  it('cột thời điểm không đổi theo kỳ và không lẫn người khác', () => {
    for (const p of ['today', '7d', '30d'] as const) {
      const s = staffPeriodStats('o1', rows, accounts, activities, p, now);
      expect(s.totalAccounts).toBe(3);
      expect(s.openCount).toBe(1);
      expect(s.openValue).toBe(50_000_000);
      expect(s.expectedCommission).toBe(5_000_000);
      expect(s.overdueTasks).toBe(1);
    }
    const other = staffPeriodStats('o2', rows, accounts, activities, 'today', now);
    expect(other.wonDeals).toBe(1);
    expect(other.totalAccounts).toBe(1);
  });
});
