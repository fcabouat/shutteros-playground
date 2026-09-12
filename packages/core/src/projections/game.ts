import type { GameConfig } from '../model/configuration';
import {
  challengeOrder,
  type ChallengeId,
  type ChallengeResult,
  type GameState,
} from '../model/game';

export { challengeOrder } from '../model/game';

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
  return challengeOrder.find((id) => !hasResult(state, id)) ?? null;
}

export function hasResult(state: GameState, id: ChallengeId): boolean {
  return state.phase === 'session' && state.results.some((result) => result.id === id);
}

export function allComplete(state: GameState): boolean {
  return state.phase === 'session' && challengeOrder.every((id) => hasResult(state, id));
}

/** A risky USB outcome opens the incident situation unless it was already settled. */
export function incidentFollowsFeedback(state: GameState, result: ChallengeResult): boolean {
  return result.id === 'usb' && result.outcome === 'risky' && !hasResult(state, 'incident');
}

/** Isolation remains meaningful whether its reporting step is open, paused, or completed. */
export function incidentIsolated(state: GameState): boolean {
  return (
    state.phase === 'session' &&
    (state.pendingIncident !== null ||
      (state.scene.kind === 'challenge' &&
        state.scene.id === 'incident' &&
        state.scene.step === 'notify') ||
      state.results.some((result) => result.id === 'incident' && result.outcome === 'safe'))
  );
}

export function safeCount(state: GameState): number {
  if (state.phase !== 'session') return 0;
  return state.results.filter((result) => result.id !== 'spoof' && result.outcome === 'safe')
    .length;
}

/** Count assessed situations only; spoof is an acknowledged local demonstration. */
export function assessedCount(state: GameState): number {
  if (state.phase !== 'session') return 0;
  return state.results.filter((result) => result.id !== 'spoof').length;
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

/** The zero-based session interval, or null before a session starts. */
export function ambientSlot(
  state: GameState,
  config: Pick<GameConfig, 'eventIntervalMs'>,
): number | null {
  if (state.phase !== 'session') return null;
  return Math.max(0, Math.floor((state.now - state.startedAt) / config.eventIntervalMs));
}

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
  const slot = ambientSlot(state, config);
  if (slot === null) return null;
  if (slot < 1) return null;
  const event = ambientOrder[(slot - 1) % ambientOrder.length];
  if (event === undefined) return null;
  if (event === 'password') return state.routines.password === 'pending' ? event : null;
  if (event === 'update') return state.routines.update === 'pending' ? event : null;
  return state.routines.lockPracticed ? null : event;
}
