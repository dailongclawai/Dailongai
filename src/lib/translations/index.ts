export type Locale = 'vi' | 'en' | 'zh' | 'ja' | 'ko' | 'ru';

export const localeNames: Record<Locale, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  ru: 'Русский',
};

const loaders: Record<Locale, () => Promise<{ default: Record<string, string> }>> = {
  vi: () => import('./vi'),
  en: () => import('./en'),
  zh: () => import('./zh'),
  ja: () => import('./ja'),
  ko: () => import('./ko'),
  ru: () => import('./ru'),
};

const cache: Partial<Record<Locale, Record<string, string>>> = {};

export async function loadTranslations(locale: Locale): Promise<Record<string, string>> {
  if (cache[locale]) return cache[locale];
  const mod = await loaders[locale]();
  cache[locale] = mod.default;
  return mod.default;
}
