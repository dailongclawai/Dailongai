'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useI18n, localeNames } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

const flagUrls: Record<Locale, string> = {
  vi: 'https://flagcdn.com/w40/vn.png',
  en: 'https://flagcdn.com/w40/gb.png',
  zh: 'https://flagcdn.com/w40/cn.png',
  ja: 'https://flagcdn.com/w40/jp.png',
  ko: 'https://flagcdn.com/w40/kr.png',
  ru: 'https://flagcdn.com/w40/ru.png',
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
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px', padding: '6px 10px',
          cursor: 'pointer', fontSize: '12px', color: '#c8c6c5',
          fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700,
        }}
      >
        <img src={flagUrls[locale]} alt="" width={20} height={14} loading="lazy" decoding="async" fetchPriority="low" style={{ borderRadius: '2px', objectFit: 'cover' }} />
        <span className="hidden sm:inline">{localeNames[locale]}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '6px',
          background: '#1a1c1e', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px', overflow: 'hidden', zIndex: 200,
          minWidth: '160px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => { startTransition(() => setLocale(l)); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: '10px 14px',
                background: l === locale ? 'rgba(255,86,37,0.1)' : 'transparent',
                border: 'none', cursor: 'pointer',
                color: l === locale ? '#ff5625' : '#c8c6c5',
                fontSize: '13px', fontWeight: 600,
                fontFamily: "'Space Grotesk',sans-serif",
                textAlign: 'left',
              }}
            >
              <img src={flagUrls[l]} alt="" width={22} height={15} loading="lazy" decoding="async" style={{ borderRadius: '2px', objectFit: 'cover' }} />
              <span>{localeNames[l]}</span>
              {l === locale && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff5625" strokeWidth="2.5" style={{ marginLeft: 'auto' }}>
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
