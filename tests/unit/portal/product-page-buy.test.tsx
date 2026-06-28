import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductPage from '@/components/ProductPage';

vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ t: (k: string) => k, locale: 'vi' }) }));
vi.mock('@/lib/gsap-loader', () => ({ loadGSAP: async () => ({ gsap: { context: () => ({ revert(){} }), fromTo(){} }, ScrollTrigger: { refresh(){} } }) }));
vi.mock('@/components/portal/QuickCheckout', () => ({ QuickCheckout: () => <div data-testid="quick-checkout" /> }));

describe('ProductPage buy now', () => {
  it('opens QuickCheckout modal on Mua ngay click', () => {
    render(<ProductPage />);
    expect(screen.queryByTestId('quick-checkout')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'product.buy_now' }));
    expect(screen.getByTestId('quick-checkout')).toBeInTheDocument();
  });

  it('closes the modal on overlay click', () => {
    render(<ProductPage />);
    fireEvent.click(screen.getByRole('button', { name: 'product.buy_now' }));
    expect(screen.getByTestId('quick-checkout')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByTestId('quick-checkout')).toBeNull();
  });
});
