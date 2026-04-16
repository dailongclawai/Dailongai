'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { sanitizeHtml } from '@/lib/sanitize';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

function nowTime() {
  return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function MeoChatFullscreen({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showQR, setShowQR] = useState(true);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const { t, locale } = useI18n();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<import('@/lib/avatar-scene').AvatarScene | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const QUICK_REPLIES = [t('chat.qr1'), t('chat.qr2'), t('chat.qr3'), t('chat.qr4')];

  // Initialize avatar scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    (async () => {
      try {
        const { AvatarScene } = await import('@/lib/avatar-scene');
        if (cancelled) return;
        const scene = new AvatarScene(canvas);
        await scene.load('/assets/avatar-meo.vrm');
        if (cancelled) { scene.dispose(); return; }
        scene.start();
        sceneRef.current = scene;
        setAvatarLoading(false);
      } catch (err) {
        console.error('[meo-chat] avatar init failed:', err);
        setAvatarLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setTimeout(() => {
        setMessages([{ role: 'assistant', content: t('chat.welcome'), time: nowTime() }]);
      }, 400);
    }
  }, []);

  // Update welcome on locale change
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === 'assistant') {
      setMessages([{ role: 'assistant', content: t('chat.welcome'), time: messages[0].time }]);
    }
  }, [locale]);

  // Play TTS audio and drive lip-sync
  const playTTS = useCallback(async (text: string) => {
    if (muted) return;
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 2000) }),
      });
      if (!res.ok) return;

      const arrayBuffer = await res.arrayBuffer();
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Create source → destination for speaker + analyser stream for lip-sync
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Connect to speakers
      source.connect(ctx.destination);

      // Create a MediaStream for the avatar lip-sync analyser
      const dest = ctx.createMediaStreamDestination();
      source.connect(dest);
      sceneRef.current?.attachAudioStream(dest.stream);

      setSpeaking(true);
      source.start(0);
      sourceNodeRef.current = source;

      source.onended = () => {
        setSpeaking(false);
        sourceNodeRef.current = null;
      };
    } catch (err) {
      console.warn('[meo-chat] TTS playback failed:', err);
      setSpeaking(false);
    }
  }, [muted]);

  // Stop current audio
  const stopAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      sourceNodeRef.current = null;
    }
    setSpeaking(false);
  }, []);

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput('');
    setShowQR(false);
    setBusy(true);
    stopAudio();

    const userMsg: Message = { role: 'user', content: msg, time: nowTime() };
    setMessages(prev => [...prev, userMsg]);

    const history = [...messages, userMsg]
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      const reply = data.content ?? t('chat.error');
      setMessages(prev => [...prev, { role: 'assistant', content: reply, time: nowTime() }]);

      // Trigger TTS (non-blocking)
      playTTS(reply);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: t('chat.disconnect'),
        time: nowTime(),
      }]);
    }

    setBusy(false);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Latest assistant message for speech bubble
  const latestAssistant = [...messages].reverse().find(m => m.role === 'assistant');

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at center, #1a1020 0%, #0a0a12 60%, #050508 100%)' }}>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 px-6 py-4 flex justify-between items-center z-20">
        <div className="flex items-center gap-3">
          <span className="text-orange-500 text-sm font-bold tracking-[2px]">MEO MEO AI</span>
          <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-green-500/80 text-[10px] tracking-wider">ONLINE</span>
          </div>
        </div>
        <button onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors cursor-pointer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Speech bubble */}
      {latestAssistant && (
        <div className="absolute z-10 max-w-[75%] text-center"
          style={{ top: '10%', left: '50%', transform: 'translateX(-50%)', animation: 'fadeInUp 0.3s ease-out' }}>
          <div className="relative bg-white/[0.07] backdrop-blur-[16px] text-white/90 px-5 py-3.5 rounded-2xl text-sm leading-relaxed border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(latestAssistant.content.replace(/\n/g, '<br/>')) }} />
          <div className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 rotate-45 w-3.5 h-3.5 bg-white/[0.07] border-r border-b border-white/[0.08]" />
          {/* Speaking indicator */}
          {speaking && (
            <div className="mt-3 flex items-center justify-center gap-1.5">
              <div className="flex gap-[2px] items-center h-4">
                {[0, 1, 2, 3, 4].map(i => (
                  <span key={i} className="w-[2px] bg-orange-500 rounded-[1px] inline-block"
                    style={{ height: [8, 14, 6, 12, 5][i], animation: `meoWave 0.6s ease-in-out ${i * 0.1}s infinite` }} />
                ))}
              </div>
              <span className="text-orange-500/60 text-[9px] tracking-wider">SPEAKING</span>
            </div>
          )}
        </div>
      )}

      {/* Typing indicator in bubble position */}
      {busy && !latestAssistant && (
        <div className="absolute z-10 text-center" style={{ top: '10%', left: '50%', transform: 'translateX(-50%)' }}>
          <div className="bg-white/[0.07] backdrop-blur-[16px] px-5 py-3.5 rounded-2xl border border-white/[0.08]">
            <div className="flex gap-1 py-0.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-[7px] h-[7px] rounded-full bg-orange-500 inline-block"
                  style={{ animation: `tdot 1.3s ease-in-out ${i * 0.18}s infinite` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Avatar canvas */}
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Subtle glow */}
        <div className="absolute w-[280px] h-[280px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)' }} />
        <canvas ref={canvasRef} className="w-full h-full pointer-events-none" style={{ maxWidth: '520px', maxHeight: '80vh' }} />
        {avatarLoading && (
          <div className="absolute flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full"
              style={{ animation: 'spin 1s linear infinite' }} />
            <span className="text-white/30 text-xs tracking-wider">LOADING AVATAR...</span>
          </div>
        )}
      </div>

      {/* Quick replies */}
      {showQR && !busy && messages.length <= 1 && (
        <div className="absolute z-10 flex flex-wrap gap-2 justify-center px-5" style={{ bottom: '80px', left: 0, right: 0 }}>
          {QUICK_REPLIES.map(q => (
            <button key={q} onClick={() => handleSend(q)}
              className="bg-orange-500/[0.08] border border-orange-500/[0.15] text-orange-500/80 rounded-full px-4 py-1.5 text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:bg-orange-500/[0.15] transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Bottom input */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-6 pb-6 pt-10"
        style={{ background: 'linear-gradient(transparent 0%, rgba(5,5,8,0.9) 40%)' }}>
        <div className="flex gap-3 items-center max-w-[600px] mx-auto">
          {/* Mute button */}
          <button onClick={() => { setMuted(m => !m); if (!muted) stopAudio(); }}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title={muted ? 'Bật tiếng' : 'Tắt tiếng'}>
            {muted ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-3.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
            )}
          </button>

          {/* Text input */}
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('chat.placeholder')}
            rows={1}
            className="flex-1 bg-white/[0.06] backdrop-blur-xl border border-orange-500/[0.12] rounded-3xl px-5 py-3 text-white/90 text-sm outline-none resize-none min-h-[44px] leading-snug font-[inherit] placeholder:text-white/30 focus:border-orange-500/30 transition-colors"
          />

          {/* Send button */}
          <button onClick={() => handleSend()} disabled={busy || !input.trim()}
            className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 0 20px rgba(249,115,22,0.3)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          </button>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes meoWave { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.8); } }
        @keyframes tdot { 0%,80%,100% { opacity:.25; transform:scale(.85) } 40% { opacity:1; transform:scale(1.1) } }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}
