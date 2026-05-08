import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n';
import MeoChatPanel from '@/components/MeoChatPanel';

function renderPanel() {
  return render(
    <I18nProvider>
      <MeoChatPanel onClose={() => {}} />
    </I18nProvider>
  );
}

describe('MeoChatPanel — empty state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders the four quick-reply buttons before any message is sent', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /ZhiDun hoạt động/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ZhiDun là gì/i })).toBeInTheDocument();
  });

  it('renders the welcome bubble after 400ms', () => {
    renderPanel();
    expect(screen.queryByText(/Meo Meo xin chào/)).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(450); });
    expect(screen.getByText(/Meo Meo xin chào/)).toBeInTheDocument();
  });

  it('renders the AI Meo Meo header tagline', () => {
    renderPanel();
    expect(screen.getByText('AI Meo Meo')).toBeInTheDocument();
    expect(screen.getByText(/Powered by Do Ngoc Long/i)).toBeInTheDocument();
  });
});
