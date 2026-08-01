import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createCrmAccount, moveOpportunityStage, completeActivity,
  updateCrmAccount, updateCrmOpportunity,
} from '@/lib/portal-queries';

const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
const updateEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
const updateMock = vi.fn((..._args: unknown[]) => ({ eq: updateEqMock }));
const fromMock = vi.fn(() => ({
  insert: insertMock,
  update: updateMock,
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ from: fromMock }),
}));

beforeEach(() => {
  fromMock.mockClear();
  insertMock.mockClear();
  updateMock.mockClear();
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

// Sửa hộ không được đổi chủ: payload UPDATE tuyệt đối không mang owner_id,
// kẻo admin mở drawer sửa giúp là cướp luôn khách/hoa hồng của nhân viên.
describe('updateCrmAccount', () => {
  it('không ghi đè owner_id khi sửa khách', async () => {
    await updateCrmAccount('acc-1', { name: 'Cô Lan', kind: 'customer', ownerId: 'editor-9' });
    expect(updateMock.mock.calls[0][0]).not.toHaveProperty('owner_id');
    expect(updateEqMock).toHaveBeenCalledWith('id', 'acc-1');
  });
});

describe('updateCrmOpportunity', () => {
  it('không ghi đè owner_id khi sửa cơ hội', async () => {
    await updateCrmOpportunity('opp-1', {
      accountId: 'a1', stageId: 's1', name: 'Đơn máy', amount: 1_000_000, ownerId: 'editor-9',
    });
    expect(updateMock.mock.calls[0][0]).not.toHaveProperty('owner_id');
    expect(updateEqMock).toHaveBeenCalledWith('id', 'opp-1');
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
