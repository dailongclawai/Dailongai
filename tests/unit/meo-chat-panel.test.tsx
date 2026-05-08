import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('shows the M:SS countdown when 30 seconds remain and hides it on expiry', () => {
    renderPanel();
    act(() => { vi.advanceTimersByTime(330_000); }); // 360 - 330 = 30 seconds left
    expect(screen.getByText('0:30')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(31_000); }); // crosses 0
    expect(screen.queryByText(/^0:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Hết thời gian chat/)).toBeInTheDocument();
  });
});

describe('MeoChatPanel — TTS opt-in', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('plays TTS only after the speaker icon is clicked', async () => {
    const playSpy = vi.fn().mockResolvedValue(undefined);
    const pauseSpy = vi.fn();
    Object.defineProperty(window.HTMLMediaElement.prototype, 'play', { configurable: true, value: playSpy });
    Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', { configurable: true, value: pauseSpy });
    // URL.createObjectURL is not available in jsdom; stub it so the TTS flow can proceed
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (String(url).includes('/api/tts')) {
        return Promise.resolve(new Response(new ArrayBuffer(2048), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } }));
      }
      return Promise.resolve(new Response(JSON.stringify({ content: 'Câu trả lời TTS' }), { status: 200 }));
    });
    renderPanel();
    act(() => { vi.advanceTimersByTime(450); });
    fireEvent.click(screen.getByRole('button', { name: /ZhiDun là gì/i }));
    await waitFor(() => expect(screen.getByText('Câu trả lời TTS')).toBeInTheDocument());
    expect(playSpy).not.toHaveBeenCalled();
    const speakers = screen.getAllByRole('button', { name: /Play voice/i });
    expect(speakers).toHaveLength(2); // welcome + AI response
    const speaker = speakers[1]; // AI response bubble
    expect(speaker).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(speaker);
    await waitFor(() => expect(playSpy).toHaveBeenCalled());
    await waitFor(() => expect(speaker).toHaveAttribute('aria-pressed', 'true'));
    fetchSpy.mockRestore();
  });
});

describe('MeoChatPanel — error retry', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows a retry button on network failure and resends on click', async () => {
    let calls = 0;
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() => {
      calls += 1;
      if (calls === 1) return Promise.reject(new TypeError('network'));
      return Promise.resolve(new Response(JSON.stringify({ content: 'Sau retry' }), { status: 200 }));
    });
    renderPanel();
    act(() => { vi.advanceTimersByTime(450); });
    fireEvent.click(screen.getByRole('button', { name: /ZhiDun là gì/i }));
    const retryBtn = await screen.findByRole('button', { name: /Thử lại/i });
    fireEvent.click(retryBtn);
    await waitFor(() => expect(screen.getByText('Sau retry')).toBeInTheDocument());
    expect(calls).toBe(2);
    fetchSpy.mockRestore();
  });
});

describe('MeoChatPanel — layout invariants', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('uses sheet shape on mobile (matchMedia min-width:768px = false)', () => {
    const mql = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), media: '(min-width: 768px)' };
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList);
    renderPanel();
    expect(screen.getByRole('dialog').dataset.shape).toBe('sheet');
  });

  it('uses panel shape on desktop', () => {
    const mql = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), media: '(min-width: 768px)' };
    vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList);
    renderPanel();
    expect(screen.getByRole('dialog').dataset.shape).toBe('panel');
  });

  it('does not render any element with backdrop-blur or a <canvas>', () => {
    renderPanel();
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('canvas')).toBeNull();
    expect(dialog.outerHTML).not.toMatch(/backdrop-blur/);
  });
});
