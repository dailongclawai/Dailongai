import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PaymentQRCard } from '@/components/portal/PaymentQRCard';

vi.mock('@/lib/vietqr', () => ({
  PAYMENT_BANK_CODE: 'MB', PAYMENT_ACCOUNT: '89588999999', PAYMENT_NAME: 'DAI LONG',
  PAYMENT_ENABLED: true,
  orderMemo: () => 'DLABCD1234',
  vietqrUrl: () => 'https://img.vietqr.io/x.png',
}));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }));

const getStatus = vi.fn();
vi.mock('@/lib/portal-queries', () => ({ getPaymentStatusPublic: (id: string) => getStatus(id) }));
vi.mock('@/lib/supabase', () => ({ getSupabaseClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }));

describe('PaymentQRCard public surface', () => {
  beforeEach(() => { vi.useFakeTimers(); getStatus.mockReset(); });
  afterEach(() => { vi.useRealTimers(); });

  it('polls get_payment_status_public and shows paid card when paid', async () => {
    getStatus.mockResolvedValue('paid');
    render(<PaymentQRCard orderId="o-1" amount={29500000} surface="public" />);
    await vi.advanceTimersByTimeAsync(0);
    await waitFor(() => expect(getStatus).toHaveBeenCalledWith('o-1'));
    await waitFor(() => expect(screen.getByText('portal.components.paymentQR.paid_title')).toBeInTheDocument());
  });
});
