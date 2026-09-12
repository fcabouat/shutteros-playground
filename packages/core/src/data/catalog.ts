import type { fr } from './fr';

type Translatable<T> = T extends (...args: infer A) => string
  ? (...args: A) => string
  : T extends string
    ? string
    : { [K in keyof T]: Translatable<T[K]> };

export type Catalog = Translatable<typeof fr>;
export type Locale = 'fr' | 'en';
