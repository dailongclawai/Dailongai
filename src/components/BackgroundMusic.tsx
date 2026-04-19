"use client";

import { useEffect, useRef, useState } from "react";

const AUDIO_SRC = "/audio/lofi-chill.mp3";
const VOLUME = 0.85;

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const pausedByChat = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = VOLUME;
    audio.loop = true;
  }, []);

  // Start on first user interaction anywhere on the page.
  useEffect(() => {
    if (started) return;
    const start = () => {
      const audio = audioRef.current;
      if (!audio) return;
      const go = () => audio.play().then(() => setStarted(true)).catch(() => {});
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
          .requestIdleCallback(go, { timeout: 400 });
      } else {
        setTimeout(go, 0);
      }
    };
    const events: (keyof DocumentEventMap)[] = ["click", "keydown", "touchstart", "pointerdown"];
    events.forEach((e) => document.addEventListener(e, start, { once: true, passive: true }));
    return () => {
      events.forEach((e) => document.removeEventListener(e, start));
    };
  }, [started]);

  // Pause when chat/video opens, resume when it closes (only if it was playing before).
  useEffect(() => {
    const onPauseTrigger = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (!audio.paused) {
        pausedByChat.current = true;
        audio.pause();
      }
    };
    const onResumeTrigger = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (pausedByChat.current && !muted) {
        pausedByChat.current = false;
        audio.play().catch(() => {});
      } else {
        pausedByChat.current = false;
      }
    };
    const pauseEvents = ["meo-chat:open", "blog-video:open"];
    const resumeEvents = ["meo-chat:close", "blog-video:close"];
    pauseEvents.forEach((e) => window.addEventListener(e, onPauseTrigger));
    resumeEvents.forEach((e) => window.addEventListener(e, onResumeTrigger));
    return () => {
      pauseEvents.forEach((e) => window.removeEventListener(e, onPauseTrigger));
      resumeEvents.forEach((e) => window.removeEventListener(e, onResumeTrigger));
    };
  }, [muted]);

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !muted;
    setMuted(next);
    audio.muted = next;
    if (!next && audio.paused && started) audio.play().catch(() => {});
  };

  const showButton = started;

  return (
    <>
      <audio ref={audioRef} src={AUDIO_SRC} preload="none" playsInline />
      {showButton && (
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Bật nhạc nền" : "Tắt nhạc nền"}
          title={muted ? "Bật nhạc nền" : "Tắt nhạc nền"}
          className="fixed bottom-5 left-5 sm:bottom-6 sm:left-6 z-[60] w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #1a1008 0%, #0d0d14 100%)",
            border: "1px solid rgba(249,115,22,0.25)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
            color: muted ? "rgba(255,255,255,0.45)" : "rgba(249,180,120,0.95)",
          }}
        >
          {muted ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15zM17 9l4 4m0-4l-4 4" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15zM17 8a5 5 0 010 8m2-12a9 9 0 010 16" />
            </svg>
          )}
        </button>
      )}
    </>
  );
}
