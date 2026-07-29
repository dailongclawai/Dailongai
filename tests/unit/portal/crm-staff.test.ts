import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminPayStaffCommission, adminSetStaff } from '@/lib/portal-queries';

const rpcMock = vi.fn().mockResolvedValue({ data: 1, error: null });
vi.mock('@/lib/supabase', () => ({ getSupabaseClient: () => ({ rpc: rpcMock }) }));

beforeEach(() => rpcMock.mockClear());

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
