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

  return (
    <div role="dialog" aria-label="AI Meo Meo chat">
      <header>
        <h2>AI Meo Meo</h2>
        <p>Powered by Do Ngoc Long</p>
        {timeLeft <= 30 && !expired && (
          <span data-role="countdown" aria-live="polite">
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </span>
        )}
        <button type="button" onClick={() => { abortRef.current?.abort(); onClose(); }} aria-label="Close">×</button>
      </header>
      <div role="log">
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
      </div>
      {retryAvailable && !busy && !expired && (
        <button type="button" onClick={() => { setRetryAvailable(false); handleSend(lastUserMsgRef.current); }}>
          Thử lại
        </button>
      )}
      {showQuickReplies && (
        <div role="group" aria-label="Quick replies">
          {QUICK_REPLIES.map(q => (
            <button type="button" key={q} onClick={() => handleSend(q)}>{q}</button>
          ))}
        </div>
      )}
      {expired && (
        <div role="alertdialog" aria-label="Session expired" data-state="expired">
          <h3>Hết thời gian chat</h3>
          <p>Phiên chat miễn phí tối đa 6 phút. Để được tư vấn chi tiết hơn, vui lòng liên hệ hotline.</p>
          <a href="tel:0935999922">Gọi 0935 999 922</a>
          <button type="button" onClick={() => { abortRef.current?.abort(); onClose(); }}>Đóng</button>
        </div>
      )}
    </div>
  );
}
