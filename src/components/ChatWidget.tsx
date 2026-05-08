'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useI18n } from '@/lib/i18n';

const loadMeoChat = () => import('./MeoChatPanel');
const MeoChatPanel = dynamic(loadMeoChat, { ssr: false });

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    window.dispatchEvent(new Event(open ? 'meo-chat:open' : 'meo-chat:close'));
  }, [open]);

  // Idle-preload Meo chat bundle so first click does not pay parse cost on main thread
  useEffect(() => {
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const w = window as IdleWindow;
    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const preload = () => { void loadMeoChat(); };
    if (w.requestIdleCallback) {
      idleHandle = w.requestIdleCallback(preload, { timeout: 4000 });
    } else {
      timeoutHandle = setTimeout(preload, 3000);
    }
    return () => {
      if (idleHandle !== undefined && w.cancelIdleCallback) w.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    };
  }, []);

  return (
    <>
      {/* FAB Button */}
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-[60] border-none bg-transparent p-0 cursor-pointer group">
          <div className="flex items-center gap-3 rounded-2xl py-2.5 px-4 pl-2.5 relative transition-all duration-300 group-hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #1a1008 0%, #0d0d14 50%, #081118 100%)',
              border: '1px solid rgba(249,115,22,0.25)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(249,115,22,0.08), inset 0 1px 0 rgba(255,255,255,0.03)',
            }}>
            {/* Hover glow */}
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ boxShadow: '0 0 30px rgba(249,115,22,0.15), 0 0 60px rgba(0,180,160,0.08)' }} />

            {/* Online dot */}
            <span className="absolute -top-1 -right-1 z-10">
              <span className="block w-3 h-3 bg-green-500 rounded-full border-2 border-[#0d0d14]" />
            </span>

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

            {/* Text */}
            <div className="flex flex-col gap-0.5 pr-1">
              <span className="text-[14px] font-bold text-white whitespace-nowrap tracking-wide">{t('chat.fab_title')}</span>
              <span className="text-[10px] font-semibold whitespace-nowrap tracking-wider"
                style={{ background: 'linear-gradient(90deg, #f97316, #00d4aa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {t('chat.fab_subtitle')}
              </span>
            </div>

            {/* Decorative accent line */}
            <div className="absolute bottom-0 left-[20%] right-[20%] h-[1px]"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.3), rgba(0,212,170,0.2), transparent)' }} />
          </div>

          <style>{`
            @keyframes fabPing { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0; transform:scale(2.5); } }
            @keyframes fabGlow {
              0%,100% { box-shadow: 0 0 12px rgba(249,115,22,0.2); border-color: rgba(249,115,22,0.35); }
              50% { box-shadow: 0 0 22px rgba(249,115,22,0.35), 0 0 40px rgba(0,180,160,0.1); border-color: rgba(249,115,22,0.5); }
            }
          `}</style>
        </button>
      )}

      {/* Fullscreen Chat */}
      {open && <MeoChatPanel onClose={() => setOpen(false)} />}
    </>
  );
}
