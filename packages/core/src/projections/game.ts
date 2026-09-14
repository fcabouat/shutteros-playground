import type { GameConfig } from '../model/configuration';
import { activityDefinition } from '../data/activities';
import {
  challengeOrder,
  guidanceDelayMs,
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

/** Only a first-attempt USB mistake can lead into an unanswered incident. */
export function incidentFollowsFeedback(state: GameState, result: ChallengeResult): boolean {
  return (
    result.id === 'usb' &&
    result.outcome === 'risky' &&
    !hasResult(state, 'incident') &&
    !(state.phase === 'session' && state.scene.kind === 'feedback' && state.scene.replay)
  );
}

/** Isolation remains meaningful whether its reporting step is open, paused, or completed. */
export function incidentIsolated(state: GameState): boolean {
  return (
    state.phase === 'session' &&
    ((!hasResult(state, 'incident') &&
      ((state.pausedActivities.incident?.step === 'notify' &&
        state.pausedActivities.incident.priorChoiceId === 'isolate') ||
        (state.scene.kind === 'challenge' &&
          state.scene.id === 'incident' &&
          state.scene.step === 'notify'))) ||
      state.results.some((result) => result.id === 'incident' && result.outcome === 'safe'))
  );
}

export function safeCount(state: GameState): number {
  if (state.phase !== 'session') return 0;
  return state.results.filter((result) => result.outcome === 'safe').length;
}

export function assessedCount(state: GameState): number {
  if (state.phase !== 'session') return 0;
  return state.results.length;
}

export function remainingSeconds(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** Contextual help advances only with active, visible time on the unresolved stage. */
export function guidanceLevel(state: GameState): 0 | 1 | 2 {
  if (state.phase !== 'session' || state.scene.kind !== 'challenge') return 0;
  const guidance = state.scene.guidance;
  const activeMs =
    guidance.activeElapsedMs +
    (guidance.activeSince === null ? 0 : Math.max(0, state.now - guidance.activeSince));
  return Math.min(2, guidance.requestedLevel + Math.floor(activeMs / guidanceDelayMs)) as 0 | 1 | 2;
}

export function guidanceTarget(state: GameState): string | null {
  if (state.phase !== 'session' || state.scene.kind !== 'challenge' || guidanceLevel(state) === 0) {
    return null;
  }
  return activityDefinition(state.scene.id).steps[state.scene.step].firstHintTarget;
}

export function loginHintVisible(state: GameState): boolean {
  if (state.phase !== 'login') return false;
  if (state.failedAttempts >= 3) return true;
  const guidance = state.loginGuidance;
  const activeMs =
    guidance.activeElapsedMs +
    (guidance.activeSince === null ? 0 : Math.max(0, state.now - guidance.activeSince));
  return activeMs >= guidanceDelayMs;
}

export function loginHelpStarted(state: GameState): boolean {
  return state.phase === 'login' && state.loginGuidance.started;
}

export function activityIsVisible(state: GameState): boolean {
  return state.phase === 'session' ? state.activityVisible : state.loginGuidance.visible;
}

export function idleReminderVisible(
  state: GameState,
  config: Pick<GameConfig, 'idleReminderMs'>,
): boolean {
  return (
    state.phase === 'session' &&
    state.mode === 'free' &&
    !state.locked &&
    state.scene.kind === 'desktop' &&
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
  if (
    state.phase !== 'session' ||
    state.mode !== 'free' ||
    state.locked ||
    state.scene.kind !== 'desktop'
  )
    return null;
  const slot = ambientSlot(state, config);
  if (slot === null) return null;
  if (slot < 1) return null;
  const event = ambientOrder[(slot - 1) % ambientOrder.length];
  if (event === undefined) return null;
  if (event === 'password') return state.routines.password === 'pending' ? event : null;
  if (event === 'update') return state.routines.update === 'pending' ? event : null;
  return state.routines.lockPracticed ? null : event;
}

export function pendingRoutines(state: GameState): ('password' | 'update' | 'lock')[] {
  if (state.phase !== 'session') return [];
  return (['password', 'update', 'lock'] as const).filter((id) =>
    id === 'password'
      ? state.routines.password !== 'done'
      : id === 'update'
        ? state.routines.update !== 'scheduled'
        : !state.routines.lockPracticed,
  );
}

export function remainingActivities(state: GameState): number {
  return state.phase === 'session'
    ? challengeOrder.length - assessedCount(state) + (pendingRoutines(state).length > 0 ? 1 : 0)
    : 0;
}

export function experienceComplete(state: GameState): boolean {
  return allComplete(state) && pendingRoutines(state).length === 0;
}
