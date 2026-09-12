import type { Locale } from '@shutteros/core/data/catalog';

/** Respect preference order and regional variants; French is the unsupported-language fallback. */
export function preferredLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const primary = language.toLowerCase().split('-')[0];
    if (primary === 'fr' || primary === 'en') return primary;
  }
  return 'fr';
}
