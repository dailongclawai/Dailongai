import { describe, it, expect } from 'vitest';
import { groupByStage, sumAmount, weightedForecast } from '@/lib/crm-board';
import type { CrmOpportunityBoardRow, CrmStage } from '@/lib/portal-types';

const stages: CrmStage[] = [
  { id: 's1', pipeline: 'b2c_device', name: 'Mới tiếp nhận', probability: 10, forecast: 'open', sort_order: 1, active: true },
  { id: 's2', pipeline: 'b2c_device', name: 'Đang quan tâm', probability: 30, forecast: 'open', sort_order: 2, active: true },
  { id: 's3', pipeline: 'b2b_dealer', name: 'Mới tiếp cận', probability: 10, forecast: 'open', sort_order: 1, active: true },
];

const row = (id: string, stage_id: string, amount: number, probability: number): CrmOpportunityBoardRow => ({
  id, code: 'CH-000001', name: 'opp ' + id, pipeline: 'b2c_device', stage_id,
  stage_name: 'x', probability, forecast: 'open', sort_order: 1, amount, quantity: 1,
  expected_close_date: '2026-08-10', owner_id: 'o1', owner_name: null,
  account_id: 'a1', account_name: 'Cô Lan', account_phone: null, account_kind: 'customer',
  contact_id: null, model_id: null, order_id: null, closed_at: null,
  lost_reason_id: null, lost_reason_name: null, lost_notes: null,
  created_at: '2026-07-27T00:00:00Z',
});

describe('groupByStage', () => {
  it('returns one column per stage of the pipeline, in sort order', () => {
    const cols = groupByStage(stages, [row('1', 's2', 100, 30)], 'b2c_device');
    expect(cols.map(c => c.stage.id)).toEqual(['s1', 's2']);
    expect(cols[0].rows).toHaveLength(0);
    expect(cols[1].rows.map(r => r.id)).toEqual(['1']);
  });

  it('ignores opportunities whose stage belongs to another pipeline', () => {
    const cols = groupByStage(stages, [row('1', 's3', 100, 10)], 'b2c_device');
    expect(cols.every(c => c.rows.length === 0)).toBe(true);
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
