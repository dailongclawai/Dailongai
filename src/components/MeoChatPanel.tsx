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

const SESSION_MAX_SEC = 6 * 60; // 6 minutes

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

export default function MeoChatPanel({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [retryAvailable, setRetryAvailable] = useState(false);
  const welcomeShownRef = useRef(false);
  const [timeLeft, setTimeLeft] = useState(SESSION_MAX_SEC);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (timeLeft === 0) setExpired(true);
  }, [timeLeft]);

  const QUICK_REPLIES = [t('chat.qr1'), t('chat.qr4'), t('chat.qr5'), t('chat.qr6')];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (welcomeShownRef.current) return;
      welcomeShownRef.current = true;
      setMessages([{ role: 'assistant', content: t('chat.welcome'), time: nowTime(), id: genId() }]);
    }, 400);
    return () => clearTimeout(timer);
  }, [t]);

  useEffect(() => {
    setMessages(prev =>
      prev.length === 1 && prev[0].role === 'assistant'
        ? [{ ...prev[0], content: t('chat.welcome') }]
        : prev
    );
  }, [locale, t]);

  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef(`meo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const lastUserMsgRef = useRef<string>('');
  const expiredDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expired) expiredDialogRef.current?.focus();
  }, [expired]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playingObjectUrlRef = useRef<string>('');
  const ttsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = 1.0;
    }
  }, []);

  function stopTTS() {
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    if (playingObjectUrlRef.current) {
      URL.revokeObjectURL(playingObjectUrlRef.current);
      playingObjectUrlRef.current = '';
    }
    if (mountedRef.current) setPlayingId(null);
  }

  async function playTTS(id: string, text: string) {
    if (playingId === id) { stopTTS(); return; }
    stopTTS();
    const audio = audioRef.current;
    if (!audio) return;
    const controller = new AbortController();
    ttsAbortRef.current = controller;
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 2000) }),
        signal: controller.signal,
      });
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1000) return;
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }));
      playingObjectUrlRef.current = url;
      audio.src = url;
      audio.onended = () => { if (mountedRef.current) setPlayingId(null); URL.revokeObjectURL(url); playingObjectUrlRef.current = ''; };
      audio.onerror = () => { if (mountedRef.current) setPlayingId(null); URL.revokeObjectURL(url); playingObjectUrlRef.current = ''; };
      setPlayingId(id);
      await audio.play();
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (mountedRef.current) setPlayingId(null);
    }
  }

  // Cleanup on unmount
  useEffect(() => () => {
    stopTTS();
    const a = audioRef.current;
    if (a) { a.onended = null; a.onerror = null; }
  }, []);

  async function handleSend(text: string) {
    const msg = text.trim();
    if (!msg || busy || expired) return;
    setBusy(true);
    setRetryAvailable(false);
    lastUserMsgRef.current = msg;
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
        role: 'assistant',
        content: t('chat.disconnect'),
        time: nowTime(),
        id: genId(),
      }]);
      setRetryAvailable(true);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => () => abortRef.current?.abort(), []);

  const showQuickReplies = messages.length <= 1 && !busy;

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
            <button type="button" aria-label="Thử lại" onClick={() => { setRetryAvailable(false); handleSend(lastUserMsgRef.current); }} style={{ alignSelf: 'flex-start', marginTop: 4, padding: '6px 12px', background: 'transparent', border: '1px solid var(--primary)', borderRadius: 999, color: 'var(--primary)', fontSize: 12, cursor: 'pointer' }}>
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
          <div role="alertdialog" aria-modal="true" aria-label="Session expired" aria-describedby="meo-chat-expired-desc" data-state="expired" tabIndex={-1} ref={expiredDialogRef} style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,8,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
            <h3 style={{ margin: 0, color: 'var(--on-surface)' }}>Hết thời gian chat</h3>
            <p id="meo-chat-expired-desc" style={{ margin: 0, color: 'color-mix(in srgb, var(--on-surface) 70%, transparent)', textAlign: 'center', maxWidth: 320 }}>
              Phiên chat miễn phí tối đa 6 phút. Để được tư vấn chi tiết hơn, vui lòng liên hệ hotline.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <a href="tel:0935999922" style={{ padding: '8px 18px', background: 'var(--primary-container)', color: 'var(--on-primary)', borderRadius: 999, textDecoration: 'none', fontWeight: 600 }}>Gọi 0935 999 922</a>
              <button type="button" onClick={() => { abortRef.current?.abort(); onClose(); }} style={{ padding: '8px 18px', background: 'transparent', border: '1px solid var(--outline-variant)', color: 'var(--on-surface)', borderRadius: 999, cursor: 'pointer' }}>Đóng</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

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
