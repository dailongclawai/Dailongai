import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QuickCheckout } from '@/components/portal/QuickCheckout';

vi.mock('@/components/portal/AddressPicker', () => ({
  emptyAddress: { province_code: 'P', province_name: 'Province', ward_code: 'W', ward_name: 'Ward', ward_district: 'District', detail: 'so 1' },
  fullAddress: () => 'so 1, W, P',
  AddressPicker: () => <div data-testid="addr" />,
}));
vi.mock('@/components/portal/InvoiceFieldsSection', () => ({
  emptyInvoice: { required: false, company_name: '', tax_code: '', email: '' },
  validateInvoice: () => '',
  InvoiceFieldsSection: () => <div data-testid="inv" />,
}));
vi.mock('@/components/portal/PaymentQRCard', () => ({ PaymentQRCard: () => <div data-testid="qr" /> }));
vi.mock('@/components/portal/ProductPicker', () => ({ ProductPicker: () => <div data-testid="product-picker" /> }));
vi.mock('@/lib/portal-queries', () => ({
  HOUSE_ORDER_SLUG: 'dai-long',
  getPublicActiveModels: vi.fn().mockResolvedValue([{ id: 'm1', code: 'ZHIDUN-CEO', name: 'ZhiDun CEO', base_price: 29500000, image_url: null }]),
  submitPublicOrder: vi.fn().mockResolvedValue('new-order-id'),
}));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock('@/lib/referral-tracker', () => ({ trackReferral: vi.fn() }));

import { submitPublicOrder, getPublicActiveModels } from '@/lib/portal-queries';

const mockSubmit = submitPublicOrder as ReturnType<typeof vi.fn>;
const mockGetModels = getPublicActiveModels as ReturnType<typeof vi.fn>;

describe('QuickCheckout', () => {
  beforeEach(() => {
    mockSubmit.mockClear();
    mockGetModels.mockClear();
    mockGetModels.mockResolvedValue([{ id: 'm1', code: 'ZHIDUN-CEO', name: 'ZhiDun CEO', base_price: 29500000, image_url: null }]);
    mockSubmit.mockResolvedValue('new-order-id');
  });

  it('submitting a valid order calls submitPublicOrder with slug from props', async () => {
    render(<QuickCheckout slug="dai-long" surface="public" hideProductPicker />);

    // Wait for models to load (getPublicActiveModels resolves, setting modelId)
    await waitFor(() => expect(mockGetModels).toHaveBeenCalled());

    // Fill customer name
    const nameInput = screen.getByPlaceholderText('Họ tên khách');
    fireEvent.change(nameInput, { target: { value: 'Nguyen Van A' } });

    // Fill phone number
    const phoneInput = screen.getByPlaceholderText('VD: 0903 123 456');
    fireEvent.change(phoneInput, { target: { value: '0903123456' } });

    // Submit the form — address is pre-filled via mock emptyAddress with valid values
    const submitButton = screen.getByRole('button', { name: 'Đặt & thanh toán' });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Assert submitPublicOrder was called with the right slug
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'dai-long' })
    ));

    // Confirm it reached the success path — QR card should appear
    await waitFor(() => expect(screen.getByTestId('qr')).toBeInTheDocument());
  });

  it('does not render ProductPicker when hideProductPicker is true', async () => {
    render(<QuickCheckout slug="dai-long" surface="public" hideProductPicker />);
    await waitFor(() => expect(mockGetModels).toHaveBeenCalled());
    expect(screen.queryByTestId('product-picker')).not.toBeInTheDocument();
  });

  it('renders ProductPicker when hideProductPicker is false', async () => {
    render(<QuickCheckout slug="dai-long" surface="public" />);
    await waitFor(() => expect(mockGetModels).toHaveBeenCalled());
    expect(screen.getByTestId('product-picker')).toBeInTheDocument();
  });

  it('shows dealerName header line when dealerName is provided', async () => {
    render(<QuickCheckout slug="dai-long" surface="public" hideProductPicker dealerName="ABC Dealer" />);
    await waitFor(() => expect(mockGetModels).toHaveBeenCalled());
    expect(screen.getByText(/Đại lý phụ trách/)).toBeInTheDocument();
    expect(screen.getByText('ABC Dealer')).toBeInTheDocument();
  });

  it('shows Gửi đơn button label when dealerName is provided', async () => {
    render(<QuickCheckout slug="dai-long" surface="public" hideProductPicker dealerName="ABC Dealer" />);
    await waitFor(() => expect(mockGetModels).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Gửi đơn' })).toBeInTheDocument();
  });
});
