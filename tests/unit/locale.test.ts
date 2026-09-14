import { expect, it } from 'vitest';
import { preferredLocale } from '../../src/lib/components/i18n/locale';

it.each([
  [['en-GB', 'fr'], 'en'],
  [['fr-CA', 'en-US'], 'fr'],
  [['de-DE', 'EN-us', 'fr-FR'], 'en'],
  [['de-DE'], 'fr'],
  [[], 'fr'],
] as const)('selects the first supported browser language from %j', (languages, expected) => {
  expect(preferredLocale(languages)).toBe(expected);
});
