'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Locale } from './translations';
import { localeNames, loadTranslations } from './translations';
import vi from './translations/vi';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

const validLocales: Locale[] = ['vi', 'en', 'zh', 'ja', 'ko', 'ru'];

function detectLocale(): Locale {
  // 1. User previously chose a language
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('dl-locale') as Locale | null;
    if (saved && validLocales.includes(saved)) return saved;
  }

  // 2. Detect from browser language
  if (typeof navigator !== 'undefined') {
    const langs = navigator.languages ?? [navigator.language];
    let hasVietnamese = false;
    for (const raw of langs) {
      const code = raw.split('-')[0].toLowerCase() as Locale;
      if (code === 'vi') hasVietnamese = true;
      if (validLocales.includes(code)) return code;
    }
    // Browser language not supported & not Vietnamese → English
    if (!hasVietnamese) return 'en';
  }

  // 3. Fallback to Vietnamese (primary audience)
  return 'vi';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Vietnamese loaded synchronously so SSG/first render has real text
  const [locale, setLocaleState] = useState<Locale>('vi');
  const [messages, setMessages] = useState<Record<string, string>>(vi);

  // Detect and load locale on mount
  useEffect(() => {
    const detected = detectLocale();
    if (detected !== 'vi') {
      loadTranslations(detected).then((msgs) => {
        setLocaleState(detected);
        setMessages(msgs);
      });
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem('dl-locale', l);
    if (l === 'vi') {
      setLocaleState(l);
      setMessages(vi);
    } else {
      loadTranslations(l).then((msgs) => {
        setLocaleState(l);
        setMessages(msgs);
      });
    }
  }, []);

  const t = useCallback((key: string): string => {
    return messages[key] ?? vi[key] ?? key;
  }, [messages]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export { localeNames };
export type { Locale };
