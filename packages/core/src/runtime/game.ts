import type { GameConfig } from '../model/configuration';
import { activityDefinition } from '../data/activities';
import {
  allComplete,
  hasResult,
  incidentFollowsFeedback,
  pendingRoutines,
} from '../projections/game';
import { currentKnowledgeId, knowledgeAnswer } from '../services/knowledge';
import { isLoginChoiceId, passwordCategory } from '../services/passwords';
import {
  challengeOrder,
  choiceOutcome,
  guidanceDelayMs,
  type ChallengeId,
  type ChallengeResult,
  type GameState,
  type GuidanceClock,
  type GuidanceLevel,
  type Intent,
  type Journey,
  type PlayMode,
  type Scene,
} from '../model/game';

/** The zero-time default lets the static shell render without consulting a browser clock. */
export function initialState(now = 0): GameState {
  return {
    phase: 'welcome',
    generation: 0,
    now: finiteTime(now, 0),
    reason: 'initial',
    mode: 'free',
  };
}

/**
 * Reduce one internal command against validated configuration and caller-supplied time.
 * Expiration is checked when a command arrives, not only on ticks: a delayed browser
 * callback must not let a late click earn a result or extend the session.
 *
 * Order matters: global expiry, explicit logout, lock handling, then scene commands.
 * See the deadline-boundary and background-incident cases in
 * packages/core/tests/game.test.ts. Unknown Intent variants are compile-time errors
 * through assertNever; this function is not a decoder for arbitrary external objects.
 */
export function transition(
  state: GameState,
  intent: Intent,
  now: number,
  config: GameConfig,
): GameState {
  const currentNow = monotonicNow(state.now, now);

  if (state.phase === 'welcome') {
    return transitionWelcome(state, intent, currentNow);
  }
  if (state.phase === 'login') {
    return transitionLogin(state, intent, currentNow, config);
  }

  if (currentNow >= state.deadline) {
    return welcomeState(state.generation + 1, currentNow, 'expired');
  }

  const timed = { ...state, now: currentNow } as const;
  if (intent.type === 'logout') {
    return welcomeState(timed.generation + 1, currentNow, 'logout');
  }
  if (intent.type === 'set-mode') {
    return setSessionMode(timed, intent.mode);
  }
  if (timed.locked) {
    return transitionLocked(timed, intent);
  }
  switch (intent.type) {
    case 'login':
    case 'answer-login':
    case 'begin':
    case 'tick':
      return timed;
    case 'continue':
      return continueScene(timed);
    case 'open':
      return openChallenge(timed, intent.id);
    case 'request-hint':
      return requestHint(timed);
    case 'hint-viewed':
      return recordHintViewed(timed);
    case 'open-usb-readme':
      return openUsbReadme(timed);
    case 'send-ai':
      return timed.scene.kind === 'challenge' &&
        timed.scene.id === 'ai' &&
        typeof intent.tool === 'string' &&
        typeof intent.prompt === 'string'
        ? choose(timed, `${intent.tool}-${intent.prompt}`)
        : timed;
    case 'choose':
      return choose(timed, intent.choiceId);
    case 'close':
      return closeScene(timed);
    case 'debrief':
      if (timed.scene.kind !== 'desktop' || timed.results.length === 0) return timed;
      return routinesComplete(timed) ? { ...timed, scene: { kind: 'debrief' } } : timed;
    case 'answer-check':
      return answerKnowledge(timed, intent.answerId);
    case 'activity':
      return recordActivity(timed);
    case 'activity-visible':
      return setActivityVisible(timed, intent.visible);
    case 'routine':
      return updateRoutine(timed, intent.id, intent.action);
    case 'practice-lock':
      return {
        ...timed,
        locked: true,
        scene:
          timed.scene.kind === 'challenge' ? pauseChallenge(timed.scene, timed.now) : timed.scene,
        routines: { ...timed.routines, lockPracticed: true },
      };
    case 'resume-lock':
      return timed;
    case 'dismiss-idle':
      return timed.routines.idleDismissed
        ? timed
        : { ...timed, routines: { ...timed.routines, idleDismissed: true } };
    default:
      return assertNever(intent);
  }
}

function transitionWelcome(
  state: Extract<GameState, { phase: 'welcome' }>,
  intent: Intent,
  now: number,
): GameState {
  switch (intent.type) {
    case 'begin':
      return loginState(state.generation, now, state.reason, state.mode);
    case 'set-mode':
      return isPlayMode(intent.mode) ? { ...state, now, mode: intent.mode } : { ...state, now };
    case 'logout':
      return welcomeState(state.generation + 1, now, 'logout');
    case 'tick':
    case 'login':
    case 'answer-login':
    case 'continue':
    case 'open':
    case 'request-hint':
    case 'hint-viewed':
    case 'open-usb-readme':
    case 'choose':
    case 'send-ai':
    case 'close':
    case 'debrief':
    case 'answer-check':
    case 'activity':
    case 'activity-visible':
    case 'routine':
    case 'practice-lock':
    case 'resume-lock':
    case 'dismiss-idle':
      return { ...state, now };
    default:
      return assertNever(intent);
  }
}

function transitionLogin(
  state: Extract<GameState, { phase: 'login' }>,
  intent: Intent,
  now: number,
  config: GameConfig,
): GameState {
  switch (intent.type) {
    case 'set-mode':
      if (!isPlayMode(intent.mode) || intent.mode === state.mode) return { ...state, now };
      return {
        ...state,
        now,
        mode: intent.mode,
        journey: { ...state.journey, modes: [...state.journey.modes, intent.mode] },
      };
    case 'login': {
      const loginCategory = passwordCategory(intent.password, config);
      if (loginCategory === null) {
        return {
          ...state,
          now,
          failedAttempts: Math.min(3, state.failedAttempts + 1),
        };
      }
      return startSession(state, now, config, loginCategory);
    }
    case 'answer-login':
      return state.mode === 'guided' && isLoginChoiceId(intent.choiceId)
        ? startSession(state, now, config, 'guided', intent.choiceId)
        : { ...state, now };
    case 'logout':
      return welcomeState(state.generation + 1, now, 'logout');
    case 'tick':
    case 'activity':
      return { ...state, now };
    case 'activity-visible':
      return {
        ...state,
        now,
        loginGuidance: setGuidanceVisible(state.loginGuidance, intent.visible, now),
      };
    case 'request-hint':
      return {
        ...state,
        now,
        loginGuidance: {
          ...state.loginGuidance,
          requestedLevel: 1,
        },
      };
    case 'hint-viewed':
      return loginHintIsVisible(state, now)
        ? { ...state, now, journey: appendHint(state.journey, 'login') }
        : { ...state, now };
    case 'begin':
    case 'continue':
    case 'open':
    case 'open-usb-readme':
    case 'choose':
    case 'send-ai':
    case 'close':
    case 'debrief':
    case 'answer-check':
    case 'routine':
    case 'practice-lock':
    case 'resume-lock':
    case 'dismiss-idle':
      return { ...state, now };
    default:
      return assertNever(intent);
  }
}

function startSession(
  state: Extract<GameState, { phase: 'login' }>,
  now: number,
  config: GameConfig,
  loginCategory: Extract<GameState, { phase: 'session' }>['loginCategory'],
  loginChoiceId?: Extract<GameState, { phase: 'session' }>['loginChoiceId'],
): Extract<GameState, { phase: 'session' }> {
  return {
    phase: 'session',
    generation: state.generation,
    now,
    startedAt: now,
    deadline: now + config.sessionDurationMs,
    loginCategory,
    ...(loginChoiceId === undefined ? {} : { loginChoiceId }),
    mode: state.mode,
    journey: state.journey,
    scene: { kind: 'intro' },
    results: [],
    knowledge: [],
    usbInfected: false,
    routines: {
      password: 'pending',
      update: 'pending',
      lockPracticed: false,
      lastActivityAt: now,
      idleDismissed: false,
    },
    locked: false,
    activityVisible: true,
    pausedActivities: {},
  };
}

function continueScene(state: Extract<GameState, { phase: 'session' }>): GameState {
  switch (state.scene.kind) {
    case 'intro':
      return state.mode === 'guided'
        ? advanceGuided(state)
        : { ...state, scene: { kind: 'desktop' } };
    case 'feedback': {
      if (state.mode === 'guided') return advanceGuided(state);
      if (incidentFollowsFeedback(state, state.scene.result)) {
        return openChallenge({ ...state, scene: { kind: 'desktop' } }, 'incident');
      }
      // Keep the inbox discoverable: its second message is a separate activity.
      const otherMail =
        state.scene.result.id === 'mail'
          ? 'spoof'
          : state.scene.result.id === 'spoof'
            ? 'mail'
            : null;
      if (otherMail !== null && !hasResult(state, otherMail)) {
        return openChallenge({ ...state, scene: { kind: 'desktop' } }, otherMail);
      }
      return allComplete(state) ? completeGuided(state) : { ...state, scene: { kind: 'desktop' } };
    }
    case 'routines':
      return routinesComplete(state) ? { ...state, scene: { kind: 'debrief' } } : state;
    case 'desktop':
    case 'challenge':
    case 'debrief':
      return state;
    default:
      return assertNever(state.scene);
  }
}

function openChallenge(
  state: Extract<GameState, { phase: 'session' }>,
  id: ChallengeId,
): GameState {
  if (!isChallengeId(id) || state.mode === 'guided') return state;
  if (state.scene.kind === 'challenge' && state.scene.id === id) return state;
  const available =
    state.scene.kind === 'desktop'
      ? state
      : state.scene.kind === 'challenge'
        ? leaveFreeChallenge(state)
        : state;
  if (available.scene.kind !== 'desktop') return state;
  const paused = available.pausedActivities[id];
  if (paused !== undefined) {
    return {
      ...available,
      pausedActivities: withoutPausedActivity(available.pausedActivities, id),
      scene: resumeChallenge(paused, available.now, available.activityVisible),
    };
  }
  const scene = newChallenge(id, available.now, available.activityVisible);
  return { ...available, scene };
}

/**
 * Continue the active situation before filling gaps in the fixed guided order.
 * Preserve an incident's isolation progress so the player is asked to report it,
 * rather than repeating isolation. Switching mode never extends the session.
 */
function setSessionMode(
  state: Extract<GameState, { phase: 'session' }>,
  mode: PlayMode,
): Extract<GameState, { phase: 'session' }> {
  if (!isPlayMode(mode) || mode === state.mode) return state;
  const changed = {
    ...state,
    mode,
    journey: { ...state.journey, modes: [...state.journey.modes, mode] },
  };
  if (mode === 'free' || state.scene.kind !== 'desktop') return changed;
  const next = nextUnanswered(state);
  return next === null ? completeGuided(changed) : openGuidedChallenge(changed, next);
}

function openGuidedChallenge(
  state: Extract<GameState, { phase: 'session' }>,
  id: ChallengeId,
): Extract<GameState, { phase: 'session' }> {
  if (state.scene.kind === 'challenge' && state.scene.id === id) {
    return {
      ...state,
      scene: resumeChallenge(state.scene, state.now, state.activityVisible),
    };
  }
  const paused = state.pausedActivities[id];
  if (paused !== undefined) {
    return {
      ...state,
      pausedActivities: withoutPausedActivity(state.pausedActivities, id),
      scene: resumeChallenge(paused, state.now, state.activityVisible),
    };
  }
  return { ...state, scene: newChallenge(id, state.now, state.activityVisible) };
}

function advanceGuided(state: Extract<GameState, { phase: 'session' }>): GameState {
  const next = nextUnanswered(state);
  return next === null ? completeGuided(state) : openGuidedChallenge(state, next);
}

function completeGuided(
  state: Extract<GameState, { phase: 'session' }>,
): Extract<GameState, { phase: 'session' }> {
  return { ...state, scene: routinesComplete(state) ? { kind: 'debrief' } : { kind: 'routines' } };
}

function requestHint(state: Extract<GameState, { phase: 'session' }>): GameState {
  if (state.scene.kind !== 'challenge') return state;
  const currentLevel = elapsedGuidanceLevel(state.scene.guidance, state.now);
  if (currentLevel === 1) return state;
  return {
    ...state,
    scene: {
      ...state.scene,
      guidance: {
        ...state.scene.guidance,
        requestedLevel: 1,
        activeElapsedMs: 0,
        activeSince: state.scene.guidance.visible ? state.now : null,
      },
    },
  };
}

function recordHintViewed(
  state: Extract<GameState, { phase: 'session' }>,
): Extract<GameState, { phase: 'session' }> {
  if (state.scene.kind !== 'challenge') return state;
  if (elapsedGuidanceLevel(state.scene.guidance, state.now) < 1) return state;
  return {
    ...state,
    journey: appendHint(state.journey, `${state.scene.id}:${state.scene.step}`),
  };
}

/** Record the risk without completing the exercise or triggering a simulated infection. */
function openUsbReadme(state: Extract<GameState, { phase: 'session' }>): GameState {
  const scene = state.scene;
  if (scene.kind !== 'challenge' || scene.id !== 'usb' || scene.openedReadme) return state;
  return { ...state, scene: { ...scene, openedReadme: true } };
}

function choose(state: Extract<GameState, { phase: 'session' }>, choiceId: string): GameState {
  const scene = state.scene;
  if (scene.kind !== 'challenge') return state;
  if (typeof choiceId !== 'string') return state;
  const definition = activityDefinition(scene.id);
  const actions = definition.steps[scene.step].actions as Readonly<
    Record<string, { outcome: 'safe' | 'risky'; nextStep?: 'choose' | 'notify' }>
  >;
  const action = Object.prototype.hasOwnProperty.call(actions, choiceId)
    ? actions[choiceId]
    : undefined;
  const outcome = choiceOutcome(scene.id, scene.step, choiceId);
  if (outcome === null) return state;

  if (action?.nextStep !== undefined) {
    return {
      ...state,
      scene: {
        ...scene,
        startedAt: state.now,
        step: action.nextStep,
        priorChoiceId: choiceId,
        // Each step has its own independent hint clock. Guided choices come from the mode.
        guidance: freshGuidance(state.now, scene.guidance.visible),
      },
    };
  }
  return recordResult(state, {
    id: scene.id,
    outcome,
    choiceId,
    ...(scene.openedReadme ? { openedReadme: true as const } : {}),
    ...(scene.priorChoiceId === undefined ? {} : { priorChoiceId: scene.priorChoiceId }),
  });
}

/**
 * Practice produces feedback without replacing the first outcome or its side effects.
 * A replayed USB mistake therefore does not infect the original session or send the
 * player into an unanswered incident. Duplicate clicks outside a challenge are inert.
 */
function recordResult(
  state: Extract<GameState, { phase: 'session' }>,
  result: ChallengeResult,
): GameState {
  if (hasResult(state, result.id)) {
    return {
      ...state,
      pausedActivities: withoutPausedActivity(state.pausedActivities, result.id),
      scene: { kind: 'feedback', result, replay: true },
    };
  }
  return {
    ...state,
    results: [...state.results, result],
    usbInfected: state.usbInfected || (result.id === 'usb' && result.outcome === 'risky'),
    pausedActivities: withoutPausedActivity(state.pausedActivities, result.id),
    scene: { kind: 'feedback', result, replay: false },
  };
}

function closeScene(state: Extract<GameState, { phase: 'session' }>): GameState {
  if (state.mode === 'free' && state.scene.kind === 'challenge') return leaveFreeChallenge(state);
  if (
    state.scene.kind === 'debrief' ||
    (state.mode === 'free' && state.scene.kind === 'routines')
  ) {
    return { ...setSessionMode(state, 'free'), scene: { kind: 'desktop' } };
  }
  return state;
}

/** Unresolved attempts are paused and can resume without losing their step or help. */
function leaveFreeChallenge(
  state: Extract<GameState, { phase: 'session' }>,
): Extract<GameState, { phase: 'session' }> {
  if (state.scene.kind !== 'challenge') return state;
  const paused = pauseChallenge(state.scene, state.now);
  return {
    ...state,
    pausedActivities: { ...state.pausedActivities, [paused.id]: paused },
    scene: { kind: 'desktop' },
  };
}

function transitionLocked(
  state: Extract<GameState, { phase: 'session' }>,
  intent: Intent,
): GameState {
  switch (intent.type) {
    case 'tick':
      return state;
    case 'activity':
      return recordActivity(state);
    case 'activity-visible':
      return setActivityVisible(state, intent.visible);
    case 'resume-lock':
      return {
        ...state,
        locked: false,
        scene:
          state.scene.kind === 'challenge'
            ? resumeChallenge(state.scene, state.now, state.activityVisible)
            : state.scene,
      };
    case 'logout':
      return welcomeState(state.generation + 1, state.now, 'logout');
    case 'begin':
    case 'set-mode':
    case 'answer-login':
    case 'login':
    case 'continue':
    case 'open':
    case 'request-hint':
    case 'hint-viewed':
    case 'open-usb-readme':
    case 'send-ai':
    case 'choose':
    case 'close':
    case 'debrief':
    case 'answer-check':
    case 'routine':
    case 'practice-lock':
    case 'dismiss-idle':
      return state;
    default:
      return assertNever(intent);
  }
}

function recordActivity(state: Extract<GameState, { phase: 'session' }>): GameState {
  return {
    ...state,
    routines: { ...state.routines, lastActivityAt: state.now, idleDismissed: false },
  };
}

function setActivityVisible(
  state: Extract<GameState, { phase: 'session' }>,
  visible: boolean,
): GameState {
  if (typeof visible !== 'boolean' || visible === state.activityVisible) return state;
  return {
    ...state,
    activityVisible: visible,
    scene:
      state.scene.kind !== 'challenge'
        ? state.scene
        : visible
          ? resumeChallenge(state.scene, state.now, !state.locked)
          : pauseChallenge(state.scene, state.now),
  };
}

function updateRoutine(
  state: Extract<GameState, { phase: 'session' }>,
  id: 'password' | 'update',
  action: 'complete' | 'later',
): GameState {
  if (!isRoutineId(id) || !isRoutineAction(action)) return state;
  const current = state.routines[id];
  const terminal = id === 'password' ? 'done' : 'scheduled';
  if (current === terminal || (action === 'later' && current !== 'pending')) return state;
  const status = action === 'complete' ? terminal : 'later';
  return { ...state, routines: { ...state.routines, [id]: status } };
}

function answerKnowledge(
  state: Extract<GameState, { phase: 'session' }>,
  answerId: string,
): GameState {
  const id = currentKnowledgeId(state);
  if (id === null || state.knowledge.some((answer) => answer.id === id)) return state;
  const answer = knowledgeAnswer(id, answerId);
  if (answer === null) return state;
  return { ...state, knowledge: [...state.knowledge, answer] };
}

function nextUnanswered(state: Extract<GameState, { phase: 'session' }>): ChallengeId | null {
  return challengeOrder.find((id) => !hasResult(state, id)) ?? null;
}

function routinesComplete(state: Extract<GameState, { phase: 'session' }>): boolean {
  return pendingRoutines(state).length === 0;
}

function isChallengeId(value: unknown): value is ChallengeId {
  return challengeOrder.includes(value as ChallengeId);
}

function isRoutineId(value: unknown): value is 'password' | 'update' {
  return value === 'password' || value === 'update';
}

function isRoutineAction(value: unknown): value is 'complete' | 'later' {
  return value === 'complete' || value === 'later';
}

function finiteTime(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Stale/non-finite samples do not refund play time: finiteTime and Math.max keep
 * the accepted lower bound. See the monotonic-clock cases in packages/core/tests/game.test.ts.
 */
function monotonicNow(previous: number, candidate: number): number {
  const safePrevious = finiteTime(previous, 0);
  return Math.max(safePrevious, finiteTime(candidate, safePrevious));
}

function welcomeState(
  generation: number,
  now: number,
  reason: Extract<GameState, { phase: 'welcome' }>['reason'],
): Extract<GameState, { phase: 'welcome' }> {
  return {
    phase: 'welcome',
    generation,
    now,
    reason,
    mode: 'free',
  };
}

function loginState(
  generation: number,
  now: number,
  reason: Extract<GameState, { phase: 'login' }>['reason'],
  mode: PlayMode,
): Extract<GameState, { phase: 'login' }> {
  return {
    phase: 'login',
    generation,
    now,
    reason,
    mode,
    journey: { modes: [mode], hints: [] },
    failedAttempts: 0,
    loginGuidance: freshGuidance(now, true),
  };
}

function isPlayMode(value: unknown): value is PlayMode {
  return value === 'free' || value === 'guided';
}

function appendHint(journey: Journey, context: string): Journey {
  return journey.hints.includes(context)
    ? journey
    : { ...journey, hints: [...journey.hints, context] };
}

function loginHintIsVisible(state: Extract<GameState, { phase: 'login' }>, now: number): boolean {
  return (
    state.loginGuidance.requestedLevel > 0 ||
    state.failedAttempts >= 3 ||
    activeGuidanceMs(state.loginGuidance, now) >= guidanceDelayMs
  );
}

function newChallenge(
  id: ChallengeId,
  now: number,
  visible: boolean,
): Extract<Scene, { kind: 'challenge' }> {
  return {
    kind: 'challenge',
    id,
    startedAt: now,
    step: activityDefinition(id).initialStep,
    guidance: freshGuidance(now, visible),
  };
}

function freshGuidance(now: number, visible: boolean): GuidanceClock {
  return {
    requestedLevel: 0,
    activeElapsedMs: 0,
    activeSince: visible ? now : null,
    visible,
  };
}

function activeGuidanceMs(guidance: GuidanceClock, now: number): number {
  return (
    guidance.activeElapsedMs +
    (guidance.activeSince === null ? 0 : Math.max(0, now - guidance.activeSince))
  );
}

function elapsedGuidanceLevel(guidance: GuidanceClock, now: number): GuidanceLevel {
  return Math.min(
    1,
    guidance.requestedLevel + Math.floor(activeGuidanceMs(guidance, now) / guidanceDelayMs),
  ) as GuidanceLevel;
}

function pauseGuidance(guidance: GuidanceClock, now: number): GuidanceClock {
  return {
    ...guidance,
    activeElapsedMs: activeGuidanceMs(guidance, now),
    activeSince: null,
    visible: false,
  };
}

function resumeGuidance(guidance: GuidanceClock, now: number): GuidanceClock {
  if (!guidance.visible || guidance.activeSince !== null) return guidance;
  return { ...guidance, activeSince: now };
}

function setGuidanceVisible(guidance: GuidanceClock, visible: boolean, now: number): GuidanceClock {
  if (visible === guidance.visible) return guidance;
  return visible
    ? resumeGuidance({ ...guidance, visible: true }, now)
    : pauseGuidance(guidance, now);
}

function pauseChallenge(
  scene: Extract<Scene, { kind: 'challenge' }>,
  now: number,
): Extract<Scene, { kind: 'challenge' }> {
  return { ...scene, guidance: pauseGuidance(scene.guidance, now) };
}

function resumeChallenge(
  scene: Extract<Scene, { kind: 'challenge' }>,
  now: number,
  visible: boolean,
): Extract<Scene, { kind: 'challenge' }> {
  return {
    ...scene,
    guidance: visible
      ? resumeGuidance({ ...scene.guidance, visible: true }, now)
      : { ...scene.guidance, visible: false, activeSince: null },
  };
}

function withoutPausedActivity(
  activities: Extract<GameState, { phase: 'session' }>['pausedActivities'],
  id: ChallengeId,
): Extract<GameState, { phase: 'session' }>['pausedActivities'] {
  if (!Object.prototype.hasOwnProperty.call(activities, id)) return activities;
  const remaining = { ...activities };
  delete remaining[id];
  return remaining;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
