import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCrmAccount, moveOpportunityStage, completeActivity } from '@/lib/portal-queries';

const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
const updateEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
const fromMock = vi.fn(() => ({
  insert: insertMock,
  update: vi.fn(() => ({ eq: updateEqMock })),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ from: fromMock }),
}));

beforeEach(() => {
  fromMock.mockClear();
  insertMock.mockClear();
  updateEqMock.mockClear();
});

describe('createCrmAccount', () => {
  it('inserts into crm_accounts with owner_id and trimmed name', async () => {
    await createCrmAccount({
      name: '  Cô Lan  ',
      kind: 'customer',
      phone: '0901000001',
      source: 'zalo',
      ownerId: 'owner-1',
    });
    expect(fromMock).toHaveBeenCalledWith('crm_accounts');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Cô Lan', owner_id: 'owner-1', source: 'zalo' }),
    );
  });
});

describe('moveOpportunityStage', () => {
  it('updates stage_id on crm_opportunities', async () => {
    await moveOpportunityStage('opp-1', 'stage-9');
    expect(fromMock).toHaveBeenCalledWith('crm_opportunities');
    expect(updateEqMock).toHaveBeenCalledWith('id', 'opp-1');
  });
});

describe('completeActivity', () => {
  it('sets done_at and outcome', async () => {
    await completeActivity('act-1', 'Khách hẹn gọi lại');
    expect(fromMock).toHaveBeenCalledWith('crm_activities');
    expect(updateEqMock).toHaveBeenCalledWith('id', 'act-1');
  });
});
