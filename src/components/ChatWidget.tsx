'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useI18n } from '@/lib/i18n';

const MeoChatFullscreen = dynamic(() => import('./MeoChatFullscreen'), { ssr: false });
const MeoAvatarThumb = dynamic(() => import('./MeoAvatarThumb'), { ssr: false });

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    window.dispatchEvent(new Event(open ? 'meo-chat:open' : 'meo-chat:close'));
  }, [open]);

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

            {/* Avatar thumbnail */}
            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 relative"
              style={{
                border: '2px solid rgba(249,115,22,0.35)',
                boxShadow: '0 0 12px rgba(249,115,22,0.15)',
              }}>
              <MeoAvatarThumb size={48} />
            </div>

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
      {open && <MeoChatFullscreen onClose={() => setOpen(false)} />}
    </>
  );
}
