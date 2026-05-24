'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useI18n, localeNames } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

const flagUrls: Record<Locale, string> = {
  vi: '/flags/vn.png',
  en: '/flags/gb.png',
  zh: '/flags/cn.png',
  ja: '/flags/jp.png',
  ko: '/flags/kr.png',
  ru: '/flags/ru.png',
};

const locales: Locale[] = ['vi', 'en', 'zh', 'ja', 'ko', 'ru'];

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick, { passive: true });
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Touch-friendly trigger — 44px min-height on mobile */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Switch language"
        aria-expanded={open}
        className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 text-[#c8c6c5] transition-colors hover:border-white/20 hover:bg-white/10 active:scale-[0.97] sm:px-3"
      >
        <img
          src={flagUrls[locale]}
          alt=""
          width={22}
          height={15}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          className="rounded-[2px] object-cover"
        />
        <span className="hidden font-semibold text-xs sm:inline">{localeNames[locale]}</span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown — right-aligned, safe on narrow screens */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-[200] w-44 max-h-[min(340px,80dvh)] overflow-y-auto rounded-xl border border-white/10 bg-[#1a1c1e] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overscroll-contain">
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => { startTransition(() => setLocale(l)); setOpen(false); }}
              className={`flex w-full items-center gap-3 px-3.5 py-3 text-left text-[13px] font-semibold transition-colors ${
                l === locale
                  ? 'bg-[#ff5625]/10 text-[#ff5625]'
                  : 'text-[#c8c6c5] hover:bg-white/[0.05]'
              }`}
            >
              <img src={flagUrls[l]} alt="" width={22} height={15} loading="lazy" decoding="async" className="rounded-[2px] object-cover" />
              <span className="flex-1">{localeNames[l]}</span>
              {l === locale && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff5625" strokeWidth="2.5">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
