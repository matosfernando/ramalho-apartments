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

// getLocaleUrl() lived here and derived the alternate URL by string surgery on
// the path. It assumed every page had a twin in the other language, which sent
// /faq/ and /guide/ to URLs that 404, and it dropped the trailing slash on the
// homepage ("/pt" instead of "/pt/"). Route pairing is now declared explicitly
// in src/seo/routes.ts — see switcherPath() and alternatesFor().

export function getAlternateLocale(locale: Locale): Locale {
  return locale === 'en' ? 'pt' : 'en';
}
