import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handoverAccount, adminConfirmStaffDeal, adminPayStaffCommission, adminSetStaff } from '@/lib/portal-queries';

const rpcMock = vi.fn().mockResolvedValue({ data: 1, error: null });
vi.mock('@/lib/supabase', () => ({ getSupabaseClient: () => ({ rpc: rpcMock }) }));

beforeEach(() => rpcMock.mockClear());

describe('handoverAccount', () => {
  it('calls staff_handover_account with mapped params', async () => {
    await handoverAccount('acc-1', 'staff-2', 'ghi chú');
    expect(rpcMock).toHaveBeenCalledWith('staff_handover_account', {
      p_account_id: 'acc-1', p_to_staff: 'staff-2', p_note: 'ghi chú',
    });
  });
});

describe('adminConfirmStaffDeal', () => {
  it('calls admin_confirm_staff_deal and returns affected row count', async () => {
    const n = await adminConfirmStaffDeal('opp-1');
    expect(rpcMock).toHaveBeenCalledWith('admin_confirm_staff_deal', {
      p_opportunity_id: 'opp-1', p_order_id: null,
    });
    expect(n).toBe(1);
  });
});

describe('adminPayStaffCommission', () => {
  it('calls admin_pay_staff_commission with payment ref', async () => {
    await adminPayStaffCommission('c-1', 'CK-001');
    expect(rpcMock).toHaveBeenCalledWith('admin_pay_staff_commission', {
      p_commission_id: 'c-1', p_payment_ref: 'CK-001',
    });
  });
});

describe('adminSetStaff', () => {
  it('calls admin_set_staff with segment', async () => {
    await adminSetStaff('u-1', 'b2b');
    expect(rpcMock).toHaveBeenCalledWith('admin_set_staff', {
      p_user_id: 'u-1', p_segment: 'b2b',
    });
  });
});
