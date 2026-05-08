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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: locale change must update welcome bubble content; functional updater is safe (deps don't include messages).
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
