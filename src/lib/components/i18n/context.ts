import { getContext, setContext } from 'svelte';
import type { Catalog, Locale } from '@shutteros/core/data/catalog';
import type { Challenges } from '@shutteros/core/data/challenges';
import type { incidentNotify } from '@shutteros/core/data/challenges';

export interface Translations {
  readonly locale: Locale;
  readonly text: Catalog;
  readonly challenges: Challenges;
  readonly incidentNotify: { question: string; choices: typeof incidentNotify.choices };
  changeLocale(locale: Locale): void;
}

const translationContext = Symbol('shutteros.translations');
export const provideI18n = (translations: Translations) =>
  setContext(translationContext, translations);
export const getI18n = () => getContext<Translations>(translationContext);
