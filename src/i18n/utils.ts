import { ui } from './ui';
import type { Locale, TranslationKey } from './ui';

export type { Locale, TranslationKey };

export const defaultLocale: Locale = 'en';
export const locales = ['en', 'pt'] as const;

export function useTranslations(locale: string) {
  const lang: Locale = (locale in ui) ? (locale as Locale) : defaultLocale;
  return function t(key: TranslationKey): string {
    return (ui[lang][key] ?? ui[defaultLocale][key] ?? key) as string;
  };
}

export function getLocaleUrl(currentPath: string, targetLocale: string, base = ''): string {
  const withoutBase = base ? currentPath.replace(new RegExp(`^${base}`), '') || '/' : currentPath;
  const stripped = withoutBase.replace(/^\/pt/, '') || '/';
  if (targetLocale === 'pt') {
    return `${base}/pt${stripped === '/' ? '' : stripped}`;
  }
  return `${base}${stripped}` || '/';
}

export function getCurrentLocale(pathname: string): Locale {
  return pathname.startsWith('/pt') ? 'pt' : 'en';
}

export function getAlternateLocale(locale: Locale): Locale {
  return locale === 'en' ? 'pt' : 'en';
}
