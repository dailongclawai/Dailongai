'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useI18n } from '@/lib/i18n';

const MeoChatFullscreen = dynamic(() => import('./MeoChatFullscreen'), { ssr: false });

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <>
      {/* FAB Button */}
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-[60] border-none bg-transparent p-0 cursor-pointer">
          <div className="flex items-center gap-2.5 bg-[#0f1117] border border-orange-500/50 rounded-full py-2.5 px-4 pl-3 relative shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all duration-300">
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center shrink-0">
              <BotIcon />
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-white whitespace-nowrap">{t('chat.fab_title')}</span>
              <span className="text-[10px] text-orange-500/85 font-semibold whitespace-nowrap">{t('chat.fab_subtitle')}</span>
            </div>
          </div>
        </button>
      )}

      {/* Fullscreen Chat */}
      {open && <MeoChatFullscreen onClose={() => setOpen(false)} />}
    </>
  );
}

function BotIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
      <path d="M12 2a2 2 0 012 2c0 .74-.4 1.38-1 1.73V7h1a7 7 0 017 7H4a7 7 0 017-7h1V5.73c-.6-.35-1-.99-1-1.73a2 2 0 012-2zm-2 14h4v2h-4v-2zm-4 0h2v2H6v-2zm10 0h2v2h-2v-2z" />
    </svg>
  );
}
