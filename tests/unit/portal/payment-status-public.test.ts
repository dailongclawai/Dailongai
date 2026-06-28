import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPaymentStatusPublic } from '@/lib/portal-queries';

const rpcMock = vi.fn().mockResolvedValue({
  data: [{ status: 'paid' }],
  error: null,
});
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: rpcMock }),
}));

beforeEach(() => rpcMock.mockClear());

describe('getPaymentStatusPublic', () => {
  it('calls RPC with p_order_id and returns the status string', async () => {
    const status = await getPaymentStatusPublic('order-1');
    expect(rpcMock).toHaveBeenCalledWith('get_payment_status_public', { p_order_id: 'order-1' });
    expect(status).toBe('paid');
  });

  it('returns null when no row', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });
    expect(await getPaymentStatusPublic('missing')).toBeNull();
  });

  it('returns null on RPC error', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } });
    expect(await getPaymentStatusPublic('x')).toBeNull();
  });
});
