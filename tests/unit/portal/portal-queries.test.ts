import { describe, it, expect, vi } from 'vitest';
import { recordOrder } from '@/lib/portal-queries';

const rpcMock = vi.fn().mockResolvedValue({ data: 'order-uuid', error: null });
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: rpcMock }),
}));

describe('recordOrder', () => {
  it('calls record_order RPC with mapped params and returns order id', async () => {
    const id = await recordOrder({
      modelId: 'm1',
      serialNumber: 'SN-1',
      customerName: 'K',
      customerPhone: '0901234567',
      customerAddress: null,
      salePrice: 55000000,
      saleDate: '2026-05-20',
      receiptImageUrl: null,
    });
    expect(id).toBe('order-uuid');
    expect(rpcMock).toHaveBeenCalledWith('record_order', {
      p_model_id: 'm1',
      p_serial_number: 'SN-1',
      p_customer_name: 'K',
      p_customer_phone: '0901234567',
      p_customer_address: null,
      p_sale_price: 55000000,
      p_sale_date: '2026-05-20',
      p_receipt_image_url: null,
    });
  });
});
