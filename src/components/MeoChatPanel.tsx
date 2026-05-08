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

  useEffect(() => () => abortRef.current?.abort(), []);

  const showQuickReplies = messages.length <= 1 && !busy;

  return (
    <div role="dialog" aria-label="AI Meo Meo chat">
      <header>
        <h2>AI Meo Meo</h2>
        <p>Powered by Do Ngoc Long</p>
        <button type="button" onClick={() => { abortRef.current?.abort(); onClose(); }} aria-label="Close">×</button>
      </header>
      <div role="log">
        {messages.map(m => (
          <div key={m.id} data-role={m.role}>{m.content}</div>
        ))}
      </div>
      {showQuickReplies && (
        <div role="group" aria-label="Quick replies">
          {QUICK_REPLIES.map(q => (
            <button type="button" key={q} onClick={() => handleSend(q)}>{q}</button>
          ))}
        </div>
      )}
    </div>
  );
}
