import type { Locale } from '../data/catalog';
import type { GameConfig } from '../model/configuration';
import type { GameState, LoginChoiceId, Outcome } from '../model/game';

const loginChoiceIds = ['manager', 'note', 'file'] as const;

export function isLoginChoiceId(value: unknown): value is LoginChoiceId {
  return loginChoiceIds.includes(value as LoginChoiceId);
}

/** The manager is the safe storage choice; exposed notes and ordinary files are risky. */
export function loginChoiceOutcome(value: unknown): Outcome | null {
  if (!isLoginChoiceId(value)) return null;
  return value === 'manager' ? 'safe' : 'risky';
}

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
