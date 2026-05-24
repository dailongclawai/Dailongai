# Meo Meo Chat Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the VRM-3D-avatar `MeoChatFullscreen` with a lean, M3-themed `MeoChatPanel` (responsive bottom-sheet on mobile / right side-panel on desktop), drop the avatar-related code path, and make TTS opt-in per AI bubble.

**Architecture:** A single client-side React component drives both viewports via a `matchMedia('(min-width: 768px)')` switch. No `<canvas>`, no Three.js, no `AudioContext.decodeAudioData` lip-sync. One persistent `Audio` element handles speaker-icon TTS playback per request. Session lifecycle (welcome, 6-min timer, expired overlay, abort-on-close) lives in the same component. The existing FAB in `ChatWidget.tsx` keeps its two-line tagline but swaps `MeoAvatarThumb` for an inline sparkle SVG.

**Tech Stack:** Next.js (App Router) + React 19 + TypeScript + Tailwind CSS v4 + Material Design 3 CSS tokens (already in `src/app/globals.css`) + vitest + jsdom + @testing-library/react + Playwright.

**Spec:** `docs/superpowers/specs/2026-05-08-meo-meo-chat-refactor-design.md`

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `src/components/MeoChatPanel.tsx` | Create | New responsive chat surface |
| `src/components/ChatWidget.tsx` | Modify | Re-target dynamic import + swap thumb for sparkle SVG |
| `src/components/MeoChatFullscreen.tsx` | Delete | Replaced by `MeoChatPanel` |
| `src/components/MeoAvatarThumb.tsx` | Delete | Avatar thumbnail no longer used |
| `src/lib/avatar-scene.ts` | Delete | VRM/Three.js scene no longer used |
| `public/assets/avatar-meo.vrm` | Delete | VRM model file no longer used |
| `package.json` | Modify | Remove `@pixiv/three-vrm` (keep `three`) |
| `tests/unit/meo-chat-panel.test.tsx` | Create | Unit tests for MeoChatPanel behaviors |
| `tests/e2e/meo-chat.spec.ts` | Create | Playwright e2e for FAB → panel → send |

---

## Conventions

- Working directory: `/Users/agentopenclaw/Downloads/dai-long-landing`. Run all commands from that directory unless noted.
- Package manager: **npm** (the repo has `package-lock.json`).
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `test:`.
- After every task, run `npm run lint` and `npx tsc --noEmit` before committing if the task touched `.ts`/`.tsx`.
- All new components must start with `'use client';` (App Router).

---

## Task 1: Test scaffolding for empty state

**Files:**
- Create: `tests/unit/meo-chat-panel.test.tsx`

- [ ] **Step 1: Write failing tests for empty state**

```tsx
// tests/unit/meo-chat-panel.test.tsx
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
    // Quick reply texts come from vi.ts (default locale)
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
```

- [ ] **Step 2: Verify tests fail**

```bash
npx vitest run tests/unit/meo-chat-panel.test.tsx
```

Expected: all three tests FAIL with `Cannot find module '@/components/MeoChatPanel'`.

- [ ] **Step 3: Commit failing tests**

```bash
git add tests/unit/meo-chat-panel.test.tsx
git commit -m "test: scaffold MeoChatPanel empty-state tests (RED)"
```

---

## Task 2: MeoChatPanel skeleton — empty state passes

**Files:**
- Create: `src/components/MeoChatPanel.tsx`

- [ ] **Step 1: Write minimal skeleton with welcome + quick replies**

```tsx
// src/components/MeoChatPanel.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  time: string;
  id: string;
}

function nowTime() {
  return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function genId() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function MeoChatPanel({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const welcomeShownRef = useRef(false);

  const QUICK_REPLIES = [t('chat.qr1'), t('chat.qr4'), t('chat.qr5'), t('chat.qr6')];

  // Welcome message after 400ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (welcomeShownRef.current) return;
      welcomeShownRef.current = true;
      setMessages([{ role: 'assistant', content: t('chat.welcome'), time: nowTime(), id: genId() }]);
    }, 400);
    return () => clearTimeout(timer);
  }, [t]);

  // Re-key welcome message when locale changes
  useEffect(() => {
    setMessages(prev =>
      prev.length === 1 && prev[0].role === 'assistant'
        ? [{ ...prev[0], content: t('chat.welcome') }]
        : prev
    );
  }, [locale, t]);

  const showQuickReplies = messages.length <= 1 && !busy;

  return (
    <div role="dialog" aria-label="AI Meo Meo chat">
      <header>
        <h2>AI Meo Meo</h2>
        <p>Powered by Do Ngoc Long</p>
        <button type="button" onClick={onClose} aria-label="Close">×</button>
      </header>
      <div role="log">
        {messages.map(m => (
          <div key={m.id} data-role={m.role}>{m.content}</div>
        ))}
      </div>
      {showQuickReplies && (
        <div role="group" aria-label="Quick replies">
          {QUICK_REPLIES.map(q => (
            <button type="button" key={q}>{q}</button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the three Task 1 tests pass**

```bash
npx vitest run tests/unit/meo-chat-panel.test.tsx
```

Expected: all three tests PASS.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit GREEN skeleton**

```bash
git add src/components/MeoChatPanel.tsx
git commit -m "feat: add MeoChatPanel skeleton with welcome + quick replies"
```

---

## Task 3: handleSend with /api/chat fetch + AbortController

**Files:**
- Modify: `src/components/MeoChatPanel.tsx`
- Modify: `tests/unit/meo-chat-panel.test.tsx`

- [ ] **Step 1: Add failing tests for send + abort**

Append to `tests/unit/meo-chat-panel.test.tsx`:

```tsx
import { fireEvent, waitFor } from '@testing-library/react';

describe('MeoChatPanel — send', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
```

- [ ] **Step 2: Verify tests fail**

```bash
npx vitest run tests/unit/meo-chat-panel.test.tsx
```

Expected: both new tests FAIL (`fetch` never called; close does not abort).

- [ ] **Step 3: Implement handleSend with AbortController**

In `src/components/MeoChatPanel.tsx`, after the existing `useEffect` blocks, add:

```tsx
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef(`meo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  async function handleSend(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setBusy(true);
    const userMsg: Message = { role: 'user', content: msg, time: nowTime(), id: genId() };
    setMessages(prev => [...prev, userMsg]);

    const history = [...messages, userMsg]
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Chat-Session': sessionIdRef.current,
        },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });
      const data = await res.json();
      const reply = data.content ?? t('chat.error');
      setMessages(prev => [...prev, {
        role: 'assistant', content: reply, time: nowTime(), id: genId(),
      }]);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setMessages(prev => [...prev, {
        role: 'assistant', content: t('chat.disconnect'), time: nowTime(), id: genId(),
      }]);
    } finally {
      setBusy(false);
    }
  }

  // Abort in-flight fetch on unmount or close
  useEffect(() => () => abortRef.current?.abort(), []);
```

Replace the close button to abort first:

```tsx
        <button type="button" onClick={() => { abortRef.current?.abort(); onClose(); }} aria-label="Close">×</button>
```

Wire quick replies to `handleSend`:

```tsx
              <button type="button" key={q} onClick={() => handleSend(q)}>{q}</button>
```

- [ ] **Step 4: Verify all tests pass**

```bash
npx vitest run tests/unit/meo-chat-panel.test.tsx
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MeoChatPanel.tsx tests/unit/meo-chat-panel.test.tsx
git commit -m "feat: add handleSend with AbortController + abort-on-close"
```

---

## Task 4: Session timer (6 min) + expired overlay

**Files:**
- Modify: `src/components/MeoChatPanel.tsx`
- Modify: `tests/unit/meo-chat-panel.test.tsx`

- [ ] **Step 1: Add failing test for expired overlay**

Append to `tests/unit/meo-chat-panel.test.tsx`:

```tsx
describe('MeoChatPanel — session timer', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('shows the expired overlay with "6 phút" copy after 6 minutes', () => {
    renderPanel();
    act(() => { vi.advanceTimersByTime(361_000); });
    expect(screen.getByText(/Hết thời gian chat/)).toBeInTheDocument();
    expect(screen.getByText(/6 phút/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gọi 0935 999 922/ })).toBeInTheDocument();
    expect(screen.queryByText(/3 phút/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify test fails**

```bash
npx vitest run tests/unit/meo-chat-panel.test.tsx
```

Expected: new test FAILS (no overlay rendered).

- [ ] **Step 3: Implement timer + overlay (with corrected copy)**

In `src/components/MeoChatPanel.tsx`, add the constant near the top of the file:

```tsx
const SESSION_MAX_SEC = 6 * 60; // 6 minutes
```

Inside the component, add state + effect:

```tsx
  const [timeLeft, setTimeLeft] = useState(SESSION_MAX_SEC);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(id); setExpired(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);
```

Guard `handleSend`:

```tsx
    if (!msg || busy || expired) return;
```

Add the overlay JSX before the closing `</div>` of the dialog wrapper:

```tsx
      {expired && (
        <div role="alertdialog" aria-label="Session expired" data-state="expired">
          <h3>Hết thời gian chat</h3>
          <p>Phiên chat miễn phí tối đa 6 phút. Để được tư vấn chi tiết hơn, vui lòng liên hệ hotline.</p>
          <a href="tel:0935999922">Gọi 0935 999 922</a>
          <button type="button" onClick={onClose}>Đóng</button>
        </div>
      )}
```

Add the `≤30s` countdown indicator inside the header (after the close button):

```tsx
        {timeLeft <= 30 && !expired && (
          <span data-role="countdown" aria-live="polite">
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </span>
        )}
```

- [ ] **Step 4: Verify all tests pass**

```bash
npx vitest run tests/unit/meo-chat-panel.test.tsx
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MeoChatPanel.tsx tests/unit/meo-chat-panel.test.tsx
git commit -m "feat: add 6-minute session timer with expired overlay"
```

---

## Task 5: TTS opt-in per AI bubble

**Files:**
- Modify: `src/components/MeoChatPanel.tsx`
- Modify: `tests/unit/meo-chat-panel.test.tsx`

- [ ] **Step 1: Add failing test for TTS toggle**

Append to `tests/unit/meo-chat-panel.test.tsx`:

```tsx
describe('MeoChatPanel — TTS opt-in', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('plays TTS only after the speaker icon is clicked', async () => {
    const playSpy = vi.fn().mockResolvedValue(undefined);
    const pauseSpy = vi.fn();
    Object.defineProperty(window.HTMLMediaElement.prototype, 'play', { configurable: true, value: playSpy });
    Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', { configurable: true, value: pauseSpy });
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
    const speaker = screen.getAllByRole('button', { name: /Play voice/i })[0];
    fireEvent.click(speaker);
    await waitFor(() => expect(playSpy).toHaveBeenCalled());
    fetchSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Verify test fails**

```bash
npx vitest run tests/unit/meo-chat-panel.test.tsx
```

Expected: new test FAILS (no speaker button rendered).

- [ ] **Step 3: Implement TTS opt-in**

In `src/components/MeoChatPanel.tsx`, add inside the component (after `abortRef`):

```tsx
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playingObjectUrlRef = useRef<string>('');

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = 1.0;
    }
  }, []);

  function stopTTS() {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    if (playingObjectUrlRef.current) {
      URL.revokeObjectURL(playingObjectUrlRef.current);
      playingObjectUrlRef.current = '';
    }
    setPlayingId(null);
  }

  async function playTTS(id: string, text: string) {
    if (playingId === id) { stopTTS(); return; }
    stopTTS();
    const audio = audioRef.current;
    if (!audio) return;
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 2000) }),
      });
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1000) return;
      const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }));
      playingObjectUrlRef.current = url;
      audio.src = url;
      audio.onended = () => { setPlayingId(null); URL.revokeObjectURL(url); playingObjectUrlRef.current = ''; };
      audio.onerror = () => { setPlayingId(null); URL.revokeObjectURL(url); playingObjectUrlRef.current = ''; };
      setPlayingId(id);
      await audio.play();
    } catch {
      setPlayingId(null);
    }
  }

  // Cleanup on unmount
  useEffect(() => () => stopTTS(), []);
```

In the message rendering loop, replace the placeholder bubble JSX with:

```tsx
        {messages.map(m => (
          <div key={m.id} data-role={m.role}>
            <span>{m.content}</span>
            {m.role === 'assistant' && (
              <button
                type="button"
                aria-label={playingId === m.id ? 'Stop voice playback' : 'Play voice'}
                aria-pressed={playingId === m.id}
                onClick={() => playTTS(m.id, m.content)}
              >
                {playingId === m.id ? '⏹' : '🔊'}
              </button>
            )}
          </div>
        ))}
```

- [ ] **Step 4: Verify all tests pass**

```bash
npx vitest run tests/unit/meo-chat-panel.test.tsx
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MeoChatPanel.tsx tests/unit/meo-chat-panel.test.tsx
git commit -m "feat: add per-bubble TTS opt-in (single Audio element, no decode)"
```

---

## Task 6: Network error → error bubble + retry button

**Files:**
- Modify: `src/components/MeoChatPanel.tsx`
- Modify: `tests/unit/meo-chat-panel.test.tsx`

- [ ] **Step 1: Add failing test for retry**

Append to `tests/unit/meo-chat-panel.test.tsx`:

```tsx
describe('MeoChatPanel — error retry', () => {
  beforeEach(() => { vi.useFakeTimers(); });

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
```

- [ ] **Step 2: Verify test fails**

```bash
npx vitest run tests/unit/meo-chat-panel.test.tsx
```

Expected: new test FAILS (no retry button).

- [ ] **Step 3: Implement retry**

In `src/components/MeoChatPanel.tsx`, add a `lastUserMsgRef` and a retry flag on the disconnect message.

Near other refs:

```tsx
  const lastUserMsgRef = useRef<string>('');
```

Inside `handleSend`, set the ref before fetching:

```tsx
    lastUserMsgRef.current = msg;
```

Replace the `catch` branch's disconnect push with one that flags retry:

```tsx
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: t('chat.disconnect'),
        time: nowTime(),
        id: genId(),
      }]);
      setRetryAvailable(true);
```

Add state:

```tsx
  const [retryAvailable, setRetryAvailable] = useState(false);
```

In the dialog body, after the messages map, add:

```tsx
        {retryAvailable && !busy && !expired && (
          <button type="button" onClick={() => { setRetryAvailable(false); handleSend(lastUserMsgRef.current); }}>
            Thử lại
          </button>
        )}
```

Clear the flag at the start of any successful send:

```tsx
    setRetryAvailable(false);
```

(Place that line right after `setBusy(true)` inside `handleSend`.)

- [ ] **Step 4: Verify all tests pass**

```bash
npx vitest run tests/unit/meo-chat-panel.test.tsx
```

Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MeoChatPanel.tsx tests/unit/meo-chat-panel.test.tsx
git commit -m "feat: surface retry button on chat network failure"
```

---

## Task 7: Layout — responsive sheet/panel + M3 tokens + reduced-motion

This task is mostly visual; tests focus on the responsive switch, reduced-motion respect, and absence of `backdrop-blur` / canvas. Drag-to-dismiss is implemented but visual polish (timing curves) is left to manual smoke-testing.

**Files:**
- Modify: `src/components/MeoChatPanel.tsx`
- Modify: `tests/unit/meo-chat-panel.test.tsx`

- [ ] **Step 1: Add failing tests for layout invariants**

Append to `tests/unit/meo-chat-panel.test.tsx`:

```tsx
describe('MeoChatPanel — layout invariants', () => {
  beforeEach(() => { vi.useFakeTimers(); });

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
```

- [ ] **Step 2: Verify tests fail**

```bash
npx vitest run tests/unit/meo-chat-panel.test.tsx
```

Expected: layout tests FAIL.

- [ ] **Step 3: Implement responsive layout + M3 styling**

Add at top of `src/components/MeoChatPanel.tsx`:

```tsx
function useShape(): 'sheet' | 'panel' {
  const [shape, setShape] = useState<'sheet' | 'panel'>('sheet');
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const update = () => setShape(mql.matches ? 'panel' : 'sheet');
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return shape;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return reduced;
}
```

Inside the component, call them and use shape on the wrapper. Replace the entire return JSX with this M3-themed layout (drop the unstyled placeholder markup):

```tsx
  const shape = useShape();
  const reducedMotion = useReducedMotion();

  // Lock body scroll only on mobile sheet
  useEffect(() => {
    if (shape !== 'sheet') return;
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      window.scrollTo(0, scrollY);
    };
  }, [shape]);

  const wrapperStyle: React.CSSProperties = shape === 'sheet'
    ? {
        position: 'fixed', left: 0, right: 0, bottom: 0,
        height: '85dvh', maxHeight: '85dvh',
        background: 'var(--surface-container)',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
        transform: reducedMotion ? 'none' : 'translateY(0)',
        transition: reducedMotion ? 'opacity 150ms' : 'transform 220ms ease-out, opacity 220ms ease-out',
        zIndex: 110,
        display: 'flex', flexDirection: 'column',
      }
    : {
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420, maxWidth: '100vw', height: '100vh',
        background: 'var(--surface-container)',
        borderLeft: '1px solid var(--outline-variant)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
        transform: reducedMotion ? 'none' : 'translateX(0)',
        transition: reducedMotion ? 'opacity 150ms' : 'transform 220ms ease-out, opacity 220ms ease-out',
        zIndex: 110,
        display: 'flex', flexDirection: 'column',
      };

  return (
    <>
      {shape === 'sheet' && (
        <div
          aria-hidden="true"
          onClick={() => { abortRef.current?.abort(); onClose(); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.30)', zIndex: 109 }}
        />
      )}
      <div role="dialog" aria-label="AI Meo Meo chat" data-shape={shape} style={wrapperStyle}>
        {shape === 'sheet' && (
          <div aria-hidden="true" style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, background: 'var(--outline-variant)', marginTop: 8, marginBottom: 4 }} />
        )}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--outline-variant)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>AI Meo Meo</h2>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 500, color: 'color-mix(in srgb, var(--on-surface) 60%, transparent)' }}>Powered by Do Ngoc Long</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {timeLeft <= 30 && !expired && (
              <span data-role="countdown" aria-live="polite" style={{ fontSize: 11, color: 'var(--primary)' }}>
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            )}
            <button type="button" onClick={() => { abortRef.current?.abort(); onClose(); }} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 16, border: '1px solid var(--outline-variant)', background: 'transparent', color: 'var(--on-surface)', cursor: 'pointer' }}>×</button>
          </div>
        </header>

        <div role="log" style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map(m => (
            <div
              key={m.id}
              data-role={m.role}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                padding: '8px 14px',
                borderRadius: 16,
                background: m.role === 'user'
                  ? 'color-mix(in srgb, var(--primary-container) 18%, transparent)'
                  : 'var(--surface-container-high)',
                border: m.role === 'user'
                  ? '1px solid color-mix(in srgb, var(--primary) 30%, transparent)'
                  : '1px solid var(--outline-variant)',
                color: 'var(--on-surface)',
                fontSize: 14,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
              }}
            >
              <span>{m.content}</span>
              {m.role === 'assistant' && (
                <button
                  type="button"
                  aria-label={playingId === m.id ? 'Stop voice playback' : 'Play voice'}
                  aria-pressed={playingId === m.id}
                  onClick={() => playTTS(m.id, m.content)}
                  style={{ marginLeft: 8, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: 'color-mix(in srgb, var(--on-surface) 60%, transparent)' }}
                >
                  {playingId === m.id ? '⏹' : '🔊'}
                </button>
              )}
            </div>
          ))}
          {retryAvailable && !busy && !expired && (
            <button type="button" onClick={() => { setRetryAvailable(false); handleSend(lastUserMsgRef.current); }} style={{ alignSelf: 'flex-start', marginTop: 4, padding: '6px 12px', background: 'transparent', border: '1px solid var(--primary)', borderRadius: 999, color: 'var(--primary)', fontSize: 12, cursor: 'pointer' }}>
              Thử lại
            </button>
          )}
        </div>

        {showQuickReplies && (
          <div role="group" aria-label="Quick replies" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 16px 12px' }}>
            {QUICK_REPLIES.map(q => (
              <button
                type="button"
                key={q}
                onClick={() => handleSend(q)}
                style={{ padding: '6px 14px', border: '1px solid var(--outline-variant)', background: 'transparent', borderRadius: 999, color: 'var(--on-surface)', fontSize: 12, cursor: 'pointer' }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <ChatInput onSend={handleSend} disabled={busy || expired} placeholder={t('chat.placeholder')} />

        {expired && (
          <div role="alertdialog" aria-label="Session expired" data-state="expired" style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,8,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
            <h3 style={{ margin: 0, color: 'var(--on-surface)' }}>Hết thời gian chat</h3>
            <p style={{ margin: 0, color: 'color-mix(in srgb, var(--on-surface) 70%, transparent)', textAlign: 'center', maxWidth: 320 }}>
              Phiên chat miễn phí tối đa 6 phút. Để được tư vấn chi tiết hơn, vui lòng liên hệ hotline.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <a href="tel:0935999922" style={{ padding: '8px 18px', background: 'var(--primary-container)', color: 'var(--on-primary)', borderRadius: 999, textDecoration: 'none', fontWeight: 600 }}>Gọi 0935 999 922</a>
              <button type="button" onClick={onClose} style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--outline-variant)', color: 'var(--on-surface)', borderRadius: 999, cursor: 'pointer' }}>Đóng</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
```

Add a small `ChatInput` subcomponent at the bottom of the same file:

```tsx
function ChatInput({ onSend, disabled, placeholder }: { onSend: (t: string) => void; disabled: boolean; placeholder: string }) {
  const [value, setValue] = useState('');
  function submit() {
    const v = value.trim();
    if (!v || disabled) return;
    onSend(v);
    setValue('');
  }
  return (
    <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--outline-variant)' }}>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder={placeholder}
        rows={1}
        disabled={disabled}
        style={{ flex: 1, resize: 'none', padding: '10px 14px', borderRadius: 18, background: 'var(--surface-container-high)', color: 'var(--on-surface)', border: '1px solid var(--outline-variant)', fontFamily: 'inherit', fontSize: 14 }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="Send"
        style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--primary-container)', color: 'var(--on-primary)', border: 'none', cursor: 'pointer', opacity: disabled || !value.trim() ? 0.5 : 1 }}
      >
        ➤
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Verify all tests pass**

```bash
npx vitest run tests/unit/meo-chat-panel.test.tsx
```

Expected: 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/MeoChatPanel.tsx tests/unit/meo-chat-panel.test.tsx
git commit -m "feat: responsive sheet/panel layout with M3 tokens and reduced-motion"
```

---

## Task 8: Wire ChatWidget to MeoChatPanel + sparkle SVG

**Files:**
- Modify: `src/components/ChatWidget.tsx`

- [ ] **Step 1: Update imports + dynamic import**

Replace the top of `src/components/ChatWidget.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useI18n } from '@/lib/i18n';

const loadMeoChat = () => import('./MeoChatPanel');
const MeoChatPanel = dynamic(loadMeoChat, { ssr: false });
```

Remove the `MeoAvatarThumb` dynamic import.

- [ ] **Step 2: Replace the avatar-thumbnail slot with an inline sparkle SVG**

Inside the FAB pill, replace the entire `<div>` that wraps `<MeoAvatarThumb size={48} />` with:

```tsx
            {/* Sparkle icon (inline SVG, no extra bundle) */}
            <span
              aria-hidden="true"
              style={{
                width: 40, height: 40, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'color-mix(in srgb, var(--primary-container) 18%, transparent)',
                border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                color: 'var(--primary)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2l1.8 4.7L18 8l-4.2 1.3L12 14l-1.8-4.7L6 8l4.2-1.3L12 2zm6 9l1 2.5 2.5 1-2.5 1L18 18l-1-2.5L14.5 14.5 17 13.5 18 11zM5 13l.8 2L8 15.8 6 16.5 5 19l-.8-2.5L2 16l2.2-.7L5 13z"/>
              </svg>
            </span>
```

- [ ] **Step 3: Update the open-state mount**

At the bottom of the component, replace `{open && <MeoChatFullscreen ... />}` with:

```tsx
      {open && <MeoChatPanel onClose={() => setOpen(false)} />}
```

- [ ] **Step 4: Type-check + lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors. (TypeScript will flag the `MeoChatFullscreen` import only if it remains; remove it.)

- [ ] **Step 5: Commit**

```bash
git add src/components/ChatWidget.tsx
git commit -m "refactor: point ChatWidget at MeoChatPanel and inline sparkle SVG"
```

---

## Task 9: Delete avatar/VRM code + drop @pixiv/three-vrm

**Files:**
- Delete: `src/components/MeoChatFullscreen.tsx`
- Delete: `src/components/MeoAvatarThumb.tsx`
- Delete: `src/lib/avatar-scene.ts`
- Delete: `public/assets/avatar-meo.vrm`
- Modify: `package.json`

- [ ] **Step 1: Re-verify no other component imports the doomed modules**

```bash
grep -rEln "MeoChatFullscreen|MeoAvatarThumb|avatar-scene|@pixiv/three-vrm" src 2>/dev/null
```

Expected: only the four files we are about to delete (plus, if grep is in `tests/`, the new test file — but it shouldn't import the old modules; verify nothing else).

- [ ] **Step 2: Delete files**

```bash
rm src/components/MeoChatFullscreen.tsx
rm src/components/MeoAvatarThumb.tsx
rm src/lib/avatar-scene.ts
rm public/assets/avatar-meo.vrm
```

- [ ] **Step 3: Remove `@pixiv/three-vrm` from `package.json`**

Open `package.json`, delete the `"@pixiv/three-vrm": "^3.5.2",` line in `dependencies`. Leave `"three"` untouched.

Then regenerate the lockfile:

```bash
npm install
```

Expected: `package-lock.json` updated; `node_modules/@pixiv` directory disappears.

- [ ] **Step 4: Verify build still type-checks**

```bash
npx tsc --noEmit
npm run lint
npm run test
```

Expected: type-check passes, lint passes, all unit tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/MeoChatFullscreen.tsx src/components/MeoAvatarThumb.tsx src/lib/avatar-scene.ts public/assets/avatar-meo.vrm package.json package-lock.json
git commit -m "chore: drop VRM avatar code and @pixiv/three-vrm dependency"
```

(Use `git add -A <path>` so deletes are staged; do not use bare `git add .` to avoid sweeping unrelated files.)

---

## Task 10: Playwright e2e + bundle-size check + deploy

**Files:**
- Create: `tests/e2e/meo-chat.spec.ts`

- [ ] **Step 1: Write the Playwright e2e**

```ts
// tests/e2e/meo-chat.spec.ts
import { test, expect } from '@playwright/test';

test('FAB opens MeoChatPanel and sends a quick reply', async ({ page }) => {
  await page.route('**/api/chat', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: 'Câu trả lời e2e' }) })
  );
  await page.goto('/');
  await page.getByRole('button', { name: /AI Meo Meo/i }).click();
  await expect(page.getByRole('dialog', { name: /AI Meo Meo chat/i })).toBeVisible();
  await page.getByRole('button', { name: /ZhiDun là gì/i }).click();
  await expect(page.getByText('Câu trả lời e2e')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog', { name: /AI Meo Meo chat/i })).not.toBeVisible();
});

test('reduced-motion is respected (no slide transform animation)', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: /AI Meo Meo/i }).click();
  const dialog = page.getByRole('dialog', { name: /AI Meo Meo chat/i });
  const transition = await dialog.evaluate(el => getComputedStyle(el).transition);
  expect(transition).toContain('opacity');
  expect(transition).not.toContain('transform 220ms');
  await context.close();
});
```

- [ ] **Step 2: Build + capture bundle size**

```bash
npm run build 2>&1 | tee /tmp/build-after.log
```

Note the largest First Load JS chunk for the home route. Expected: noticeably smaller than the pre-refactor build (target ~−150 KB gzip on the chat-related chunks).

- [ ] **Step 3: Run all tests**

```bash
npm run test
npx playwright test tests/e2e/meo-chat.spec.ts
```

Expected: all unit tests PASS, both Playwright tests PASS.

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Then in a browser:

1. Resize to mobile width (~375px) — confirm bottom-sheet layout, drag handle visible, click outside closes panel.
2. Resize to desktop width (>1024px) — confirm right-side panel, page underneath remains scrollable.
3. Click FAB → panel opens. Send a quick reply — answer renders. Click 🔊 — TTS plays; click again — stops.
4. Force a network error (block `/api/chat` in DevTools Network) — disconnect bubble + "Thử lại" appears; retry succeeds after unblock.
5. Wait ~6 minutes (or shorten `SESSION_MAX_SEC` temporarily) — expired overlay shows "6 phút" copy.
6. Toggle OS reduced-motion — re-open panel, confirm no slide transform.

Document any regression in the PR description.

- [ ] **Step 5: Commit and deploy**

```bash
git add tests/e2e/meo-chat.spec.ts
git commit -m "test: e2e Playwright suite for MeoChatPanel"
npm run build
npx wrangler pages deploy out
```

(Per `project_dailongai_deploy.md`, Sen Coder builds locally and deploys via `wrangler pages deploy out`. Boss authorized this in 2026-05-06.)

After deploy, verify the chat opens correctly on `https://dailongai.com/`.

---

## Self-Review Notes (filled during plan writing)

**Spec coverage:**
- Architecture & file changes — Tasks 2, 8, 9 ✓
- TTS opt-in — Task 5 ✓
- Session timer fix copy — Task 4 ✓
- Quick replies — Task 2 ✓
- Welcome message + locale — Task 2 ✓
- AbortController — Task 3 ✓
- Reduced motion — Task 7 ✓
- Retry button — Task 6 ✓
- M3 tokens / no blur / no canvas — Task 7 (with explicit absence assertions) ✓
- Responsive sheet/panel — Task 7 ✓
- FAB swap (sparkle SVG, keep tagline) — Task 8 ✓
- Delete files + remove `@pixiv/three-vrm` (keep `three`) — Task 9 ✓
- Unit tests `tests/unit/meo-chat-panel.test.tsx` — Tasks 1, 3, 4, 5, 6, 7 ✓
- E2E `tests/e2e/meo-chat.spec.ts` — Task 10 ✓
- Bundle delta verification + deploy — Task 10 ✓

**Type consistency:** `playTTS(id, text)`, `stopTTS()`, `handleSend(text)`, `useShape()`, `useReducedMotion()`, `Message.id` are referenced consistently across tasks 2–7.

**Placeholder scan:** No "TBD"/"TODO"/"implement later" tokens. All steps include concrete code or commands.
