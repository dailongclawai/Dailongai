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

const SESSION_MAX_SEC = 6 * 60; // 6 minutes

function genSessionId() {
  return `meo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function MeoChatFullscreen({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showQR, setShowQR] = useState(true);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(SESSION_MAX_SEC);
  const [expired, setExpired] = useState(false);
  const { t, locale } = useI18n();
  const sessionIdRef = useRef(genSessionId());

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<import('@/lib/avatar-scene').AvatarScene | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const QUICK_REPLIES = [t('chat.qr1'), t('chat.qr4'), t('chat.qr5'), t('chat.qr6')];

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

  // Lock body scroll when fullscreen is open
  useEffect(() => {
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
  }, []);

  // Session countdown timer (3 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setTimeout(() => {
        setMessages([{ role: 'assistant', content: t('chat.welcome'), time: nowTime() }]);
      }, 400);
    }
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  // Update welcome on locale change
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === 'assistant') {
      setMessages([{ role: 'assistant', content: t('chat.welcome'), time: messages[0].time }]);
    }
  }, [locale]);

  // Keep mutedRef in sync
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // Persistent audio element — created once, reused for all TTS
  // This avoids browser autoplay restrictions by reusing element from user gesture chain
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = 1.0;
    }
  }, []);

  // Play TTS: reuse persistent Audio element for reliability
  const playTTS = useCallback(async (text: string) => {
    if (mutedRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;

    // Stop any currently playing audio
    audio.pause();
    audio.currentTime = 0;

    let blobUrl = '';
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 2000) }),
      });
      if (!res.ok) return;

      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength < 1000) return;

      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      blobUrl = URL.createObjectURL(blob);

      audio.onended = () => {
        setSpeaking(false);
        sceneRef.current?.setSpeaking(false);
        URL.revokeObjectURL(blobUrl);
      };
      audio.onerror = () => {
        setSpeaking(false);
        sceneRef.current?.setSpeaking(false);
        URL.revokeObjectURL(blobUrl);
      };

      audio.src = blobUrl;
      setSpeaking(true);
      sceneRef.current?.setSpeaking(true);
      await audio.play();

      // Lip-sync (non-blocking, failure OK)
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') await ctx.resume();
        const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
        const source = ctx.createBufferSource();
        source.buffer = decoded;
        const dest = ctx.createMediaStreamDestination();
        source.connect(dest);
        sceneRef.current?.attachAudioStream(dest.stream);
        source.start(0);
        source.onended = () => ctx.close();
      } catch {}
    } catch {
      setSpeaking(false);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    }
  }, []);

  // Stop current audio (don't null — persistent element)
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setSpeaking(false);
    sceneRef.current?.setSpeaking(false);
  }, []);

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || busy || expired) return;
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
        headers: {
          'Content-Type': 'application/json',
          'X-Chat-Session': sessionIdRef.current,
        },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();

      // Check for session/daily limit errors
      if (data.code === 'session_expired' || data.code === 'daily_limit') {
        setExpired(true);
        setMessages(prev => [...prev, { role: 'assistant', content: data.error, time: nowTime() }]);
        setBusy(false);
        return;
      }

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
    <>
    {/* Solid black backdrop — covers everything including behind keyboard */}
    <div className="fixed z-[109]" style={{ top: '-100px', left: '-100px', right: '-100px', bottom: '-100px', backgroundColor: '#050508' }} />
    <div className="fixed z-[110] flex flex-col items-center justify-center"
      style={{ top: 0, left: 0, width: '100vw', height: '100dvh', backgroundColor: '#050508', background: 'radial-gradient(ellipse at center, #1a1020 0%, #0a0a12 60%, #050508 100%)', overflow: 'hidden' }}>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center z-20" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-lg sm:text-xl font-extrabold tracking-[2px]" style={{ background: 'linear-gradient(135deg, #8b1a2b, #c0392b, #a93226, #c0392b, #8b1a2b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 12px rgba(139,26,43,0.5))' }}>AI Meo Meo</span>
            <span className="text-[9px] sm:text-[10px] tracking-[1.5px] font-light" style={{ background: 'linear-gradient(135deg, #00d4aa, #48d89b, #7ee8c7, #48d89b, #22c55e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Powered by Do Ngoc Long</span>
          </div>
          <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-green-500/80 text-[10px] tracking-wider">ONLINE</span>
          </div>
          {/* Timer only shows when <= 30 seconds */}
          {timeLeft <= 30 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] tracking-wider font-mono bg-red-500/10 border border-red-500/20 text-red-400" style={{ animation: 'tdot 1.3s ease-in-out infinite' }}>
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          )}
        </div>
        <button onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors cursor-pointer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* (typing indicator is now inside chat area below) */}

      {/* Avatar canvas */}
      <div className="relative w-full flex-1 flex items-start justify-center overflow-hidden" style={{ minHeight: 0, paddingTop: '40px' }}>
        {/* Subtle glow */}
        <div className="absolute w-[280px] h-[280px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)' }} />
        <canvas ref={canvasRef} className="pointer-events-none" style={{ width: '100%', height: '100%', maxWidth: '520px', objectFit: 'contain' }} />
        {avatarLoading && (
          <div className="absolute flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full"
              style={{ animation: 'spin 1s linear infinite' }} />
            <span className="text-white/30 text-xs tracking-wider">LOADING AVATAR...</span>
          </div>
        )}
      </div>

      {/* Chat area below avatar: quick replies OR conversation */}
      {!expired && (
        <div className="absolute z-10 w-full px-4 sm:px-6" style={{ bottom: '90px', left: 0, right: 0 }}>
          {showQR && messages.length <= 1 && !busy ? (
            /* Quick replies - before first user message */
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_REPLIES.map(q => (
                <button key={q} onClick={() => handleSend(q)}
                  className="bg-orange-500/[0.08] border border-orange-500/[0.15] text-orange-500/80 rounded-full px-4 py-1.5 text-[11px] font-semibold cursor-pointer whitespace-nowrap hover:bg-orange-500/[0.15] transition-colors">
                  {q}
                </button>
              ))}
            </div>
          ) : messages.length > 1 || busy ? (
            /* Conversation messages */
            <div ref={chatScrollRef}
              className="max-w-[600px] mx-auto meo-scroll max-h-[200px] overflow-y-auto scroll-smooth flex flex-col gap-2"
              style={{ animation: 'fadeInUp 0.3s ease-out' }}>
              {/* Show last few messages */}
              {messages.slice(1).map((m, i) => (
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="bg-orange-500/20 backdrop-blur-[12px] text-white/90 px-3.5 py-2 rounded-2xl rounded-br-sm text-xs sm:text-sm leading-relaxed border border-orange-500/15 max-w-[80%]">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-start">
                    <div className="bg-white/[0.07] backdrop-blur-[16px] text-white/85 px-3.5 py-2 rounded-2xl rounded-bl-sm text-xs sm:text-sm leading-relaxed border border-white/[0.08] max-w-[80%]"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.content.replace(/\n/g, '<br/>')) }} />
                  </div>
                )
              ))}
              {/* Typing indicator */}
              {busy && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.07] backdrop-blur-[16px] px-4 py-2.5 rounded-2xl rounded-bl-sm border border-white/[0.08]">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-[6px] h-[6px] rounded-full bg-orange-500 inline-block"
                          style={{ animation: `tdot 1.3s ease-in-out ${i * 0.18}s infinite` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {/* Speaking indicator */}
              {speaking && !busy && (
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <div className="flex gap-[2px] items-center h-4">
                    {[0, 1, 2, 3, 4].map(i => (
                      <span key={i} className="w-[2px] bg-orange-500 rounded-[1px] inline-block"
                        style={{ height: [8, 14, 6, 12, 5][i], animation: `meoWave 0.6s ease-in-out ${i * 0.1}s infinite` }} />
                    ))}
                  </div>
                  <span className="text-orange-500/60 text-[9px] tracking-wider">SPEAKING</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          ) : null}
        </div>
      )}

      {/* Bottom input */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 sm:px-6 pt-10"
        style={{ background: 'linear-gradient(transparent 0%, rgba(5,5,8,0.9) 40%)', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
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
          <button onClick={() => handleSend()} disabled={busy || !input.trim() || expired}
            className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 0 20px rgba(249,115,22,0.3)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          </button>
        </div>
      </div>

      {/* Expired overlay */}
      {expired && (
        <div className="absolute inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
          <div className="text-center max-w-sm px-6">
            <div className="text-4xl mb-4">⏰</div>
            <h3 className="text-white text-lg font-bold mb-2">Hết thời gian chat</h3>
            <p className="text-white/60 text-sm mb-6 leading-relaxed">
              Phiên chat miễn phí tối đa 3 phút. Để được tư vấn chi tiết hơn, vui lòng liên hệ hotline.
            </p>
            <div className="flex gap-3 justify-center">
              <a href="tel:0935999922"
                className="px-5 py-2.5 rounded-full text-sm font-semibold text-white border-none cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                Gọi 0935 999 922
              </a>
              <button onClick={onClose}
                className="px-5 py-2.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-sm font-semibold cursor-pointer hover:bg-white/15 transition-colors">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>{`
        .meo-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent; }
        .meo-scroll::-webkit-scrollbar { width: 6px; }
        .meo-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 6px; }
        .meo-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 6px; }
        .meo-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }
        @keyframes meoWave { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.8); } }
        @keyframes tdot { 0%,80%,100% { opacity:.25; transform:scale(.85) } 40% { opacity:1; transform:scale(1.1) } }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @supports not (height: 100dvh) {
          .fixed[style*="100dvh"] { height: 100vh !important; height: -webkit-fill-available !important; }
        }
      `}</style>
    </div>
    </>
  );
}
