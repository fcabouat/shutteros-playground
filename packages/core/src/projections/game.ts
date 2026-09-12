import type { GameConfig } from '../model/configuration';
import type { ChallengeId, GameState, Outcome } from '../model/game';

export const challengeOrder: readonly ChallengeId[] = Object.freeze([
  'usb',
  'incident',
  'mail',
  'spoof',
  'web',
  'mfa',
]);

/** Keep launch affordances aligned with the navigation states accepted by openChallenge. */
export function canExplore(state: GameState): boolean {
  return (
    state.phase === 'session' &&
    state.mode === 'free' &&
    !state.locked &&
    (state.scene.kind === 'desktop' || state.scene.kind === 'challenge')
  );
}

export function nextChallenge(state: GameState): ChallengeId | null {
  if (state.phase !== 'session') return null;
  const complete = new Set(state.results.map((result) => result.id));
  return challengeOrder.find((id) => !complete.has(id)) ?? null;
}

export function safeCount(state: GameState): number {
  if (state.phase !== 'session') return 0;
  return state.results.filter((result) => result.outcome === ('safe' as Outcome)).length;
}

export function remainingSeconds(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** A hint may be shown after discovery time; this does not gate direct scenario actions. */
export function explorationReady(state: GameState): boolean {
  return state.phase === 'session' && state.scene.kind === 'challenge'
    ? state.now >= state.scene.exploreUntil
    : false;
}

export function idleReminderVisible(
  state: GameState,
  config: Pick<GameConfig, 'idleReminderMs'>,
): boolean {
  return (
    state.phase === 'session' &&
    state.mode === 'free' &&
    !state.locked &&
    !state.routines.lockPracticed &&
    !state.routines.idleDismissed &&
    state.now - state.routines.lastActivityAt >= config.idleReminderMs
  );
}

export type AmbientEventId = 'password' | 'update' | 'lock';

const ambientOrder: readonly AmbientEventId[] = ['password', 'update', 'lock'];

/**
 * Derive the current slot from session time instead of queuing notifications.
 * Returning from an inactive tab therefore shows at most the current reminder,
 * not a backlog. Guided mode has its own routine screen and suppresses this channel.
 */
export function nextAmbientEvent(
  state: GameState,
  config: Pick<GameConfig, 'eventIntervalMs'>,
): AmbientEventId | null {
  if (state.phase !== 'session' || state.mode !== 'free' || state.locked) return null;
  const slot = Math.floor((state.now - state.startedAt) / config.eventIntervalMs);
  if (slot < 1) return null;
  const event = ambientOrder[(slot - 1) % ambientOrder.length];
  if (event === undefined) return null;
  if (event === 'password') return state.routines.password === 'pending' ? event : null;
  if (event === 'update') return state.routines.update === 'pending' ? event : null;
  return state.routines.lockPracticed ? null : event;
}
