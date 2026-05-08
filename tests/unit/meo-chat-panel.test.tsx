import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n';
import MeoChatPanel from '@/components/MeoChatPanel';

// Vitest fake-timer compatibility: @testing-library/dom's asyncWrapper detects
// fake timers via `typeof jest !== 'undefined'`; alias vi so detection works.
(globalThis as typeof globalThis & { jest: typeof vi }).jest = vi;

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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the four quick-reply buttons before any message is sent', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /ZhiDun hoạt động/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ZhiDun là gì/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chất lượng máy ZhiDun/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bước sóng 650nm/i })).toBeInTheDocument();
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

describe('MeoChatPanel — send', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a quick reply, hides quick-reply group, and renders the AI response', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ content: 'Câu trả lời mẫu' }), { status: 200 })
    );
    renderPanel();
    act(() => { vi.advanceTimersByTime(450); });
    const qr = screen.getByRole('button', { name: /ZhiDun là gì/i });
    fireEvent.click(qr);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [, init] = fetchSpy.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ 'Content-Type': 'application/json' });
    await waitFor(() => expect(screen.getByText('Câu trả lời mẫu')).toBeInTheDocument());
    expect(screen.queryByRole('group', { name: /Quick replies/ })).not.toBeInTheDocument();
    fetchSpy.mockRestore();
  });

  it('aborts the in-flight chat fetch when onClose runs mid-request', async () => {
    let captured: AbortSignal | undefined;
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((_url, init) => {
      captured = (init as RequestInit).signal ?? undefined;
      return new Promise(() => {}); // never resolves
    });
    const onClose = vi.fn();
    render(
      <I18nProvider>
        <MeoChatPanel onClose={onClose} />
      </I18nProvider>
    );
    act(() => { vi.advanceTimersByTime(450); });
    fireEvent.click(screen.getByRole('button', { name: /ZhiDun là gì/i }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    expect(captured?.aborted).toBe(true);
    fetchSpy.mockRestore();
  });
});

describe('MeoChatPanel — session timer', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows the expired overlay with "6 phút" copy after 6 minutes', () => {
    renderPanel();
    act(() => { vi.advanceTimersByTime(361_000); });
    expect(screen.getByText(/Hết thời gian chat/)).toBeInTheDocument();
    expect(screen.getByText(/6 phút/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gọi 0935 999 922/ })).toBeInTheDocument();
    expect(screen.queryByText(/3 phút/)).not.toBeInTheDocument();
  });
});
