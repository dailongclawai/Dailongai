"use client";

import { contactInfo } from "@/data/siteData";

export default function ZaloButton() {
  if (!contactInfo.zalo) return null;

  return (
    <a
      href={contactInfo.zalo}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat Zalo"
      className="fixed bottom-24 right-6 z-50 group"
    >
      {/* Pulse ring */}
      <span className="absolute inset-0 rounded-full bg-[#0068ff] animate-pulse opacity-20" />

      {/* Button */}
      <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#0068ff] flex items-center justify-center shadow-[0_4px_20px_rgba(0,104,255,0.4)] hover:shadow-[0_4px_30px_rgba(0,104,255,0.6)] hover:scale-110 active:scale-95 transition-all duration-300">
        {/* Zalo icon */}
        <svg className="w-8 h-8 sm:w-9 sm:h-9" viewBox="0 0 48 48" fill="none">
          <path d="M12.5 7h23A5.5 5.5 0 0141 12.5v16a5.5 5.5 0 01-5.5 5.5H22.4l-7.9 5.1a1 1 0 01-1.5-.86V34h-.5A5.5 5.5 0 017 28.5v-16A5.5 5.5 0 0112.5 7z" fill="white"/>
          <text x="8" y="27" fontFamily="Arial" fontWeight="900" fontSize="11" fill="#0068ff">Zalo</text>
        </svg>
      </div>

      {/* Tooltip */}
      <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-surface-container/95 backdrop-blur-md text-on-surface text-xs font-headline font-bold px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none border border-white/10 shadow-xl">
        Chat Zalo tư vấn
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-surface-container/95 rotate-45 border-r border-t border-white/10" />
      </div>
    </a>
  );
}
