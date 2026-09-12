import type { Locale } from '../data/catalog';
import type { GameConfig } from '../model/configuration';
import type { GameState } from '../model/game';

const demoHints = { fr: 'Bureau2026', en: 'Office2026' } as const;

/** Only the built-in note is translated; an operator's phrase remains literal.
 * A translation must also be configured as accepted, including in older deployments.
 */
export function passwordHint(config: GameConfig, locale: Locale): string {
  const first = config.acceptedPasswords[0] ?? '';
  const isDemo = first === demoHints.fr || first === demoHints.en;
  return isDemo && config.acceptedPasswords.includes(demoHints[locale]) ? demoHints[locale] : first;
}

export function passwordCategory(
  password: string,
  config: GameConfig,
): Extract<GameState, { phase: 'session' }>['loginCategory'] | null {
  if (typeof password !== 'string') return null;
  // Tolerate typing and Unicode composition differences in public game phrases;
  // this is an accessibility choice for the simulation, not an authentication policy.
  const normalize = (value: string) => {
    const trimmed = value.normalize('NFC').trim();
    return config.caseSensitivePasswords ? trimmed : trimmed.toLowerCase();
  };
  const entered = normalize(password);
  if (!config.acceptedPasswords.some((candidate) => normalize(candidate) === entered)) {
    return null;
  }
  // Both configured translations teach the exposed-note lesson. No input or
  // language preference needs to be retained in the participant's domain state.
  return (['fr', 'en'] as const).some(
    (locale) => normalize(passwordHint(config, locale)) === entered,
  )
    ? 'displayed'
    : 'weak';
}
