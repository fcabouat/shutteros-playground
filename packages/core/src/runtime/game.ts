import type { GameConfig } from '../model/configuration';
import { allComplete, hasResult } from '../projections/game';
import { currentKnowledgeId, knowledgeAnswer } from '../services/knowledge';
import {
  challengeOrder,
  choiceOutcome,
  type ChallengeId,
  type ChallengeResult,
  type GameState,
  type Intent,
  type Scene,
} from '../model/game';

/** The zero-time default lets the static shell render without consulting a browser clock. */
export function initialState(now = 0): GameState {
  return {
    phase: 'login',
    generation: 0,
    now: finiteTime(now, 0),
    reason: 'initial',
    failedAttempts: 0,
  };
}

/**
 * Reduce one internal command against validated configuration and caller-supplied time.
 * Expiration is checked when a command arrives, not only on ticks: a delayed browser
 * callback must not let a late click earn a result or extend the session.
 *
 * Order matters: global expiry, explicit logout, lock handling, then local deadlines
 * before scene commands. See the deadline-boundary and background-incident cases in
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

  if (state.phase === 'login') {
    return transitionLogin(state, intent, currentNow, config);
  }

  if (currentNow >= state.deadline) {
    return loginState(state.generation + 1, currentNow, 'expired');
  }

  const timed = { ...state, now: currentNow } as const;
  if (intent.type === 'logout') {
    return loginState(timed.generation + 1, currentNow, 'logout');
  }
  if (timed.locked) {
    return transitionLocked(timed, intent);
  }
  if (
    timed.scene.kind === 'challenge' &&
    timed.scene.deadline !== null &&
    currentNow >= timed.scene.deadline
  ) {
    return recordResult(timed, {
      id: timed.scene.id,
      outcome: 'timeout',
      choiceId: 'timeout',
    });
  }
  // A hidden reporting step still owns its deadline. Settle it before commands such
  // as finish-experience can switch to guided mode and remove local challenge timing.
  const pendingDeadline = timed.pendingIncident?.deadline;
  if (pendingDeadline !== undefined && pendingDeadline !== null && currentNow >= pendingDeadline) {
    return recordResult(
      { ...timed, pendingIncident: null },
      { id: 'incident', outcome: 'timeout', choiceId: 'timeout' },
    );
  }

  switch (intent.type) {
    case 'login':
    case 'tick':
      return timed;
    case 'continue':
      return continueScene(timed, config);
    case 'open':
      return openChallenge(timed, intent.id, config);
    case 'finish-experience':
      return finishExperience(timed);
    case 'begin-decision':
      return beginDecision(timed, config);
    case 'choose':
      return choose(timed, intent.choiceId, config);
    case 'close':
      return closeScene(timed);
    case 'calm':
      return setCalm(timed, intent.enabled);
    case 'debrief':
      return timed.scene.kind === 'desktop' && timed.results.length > 0
        ? { ...timed, scene: { kind: 'debrief' } }
        : timed;
    case 'answer-check':
      return answerKnowledge(timed, intent.answerId);
    case 'activity':
      return recordActivity(timed);
    case 'routine':
      return updateRoutine(timed, intent.id, intent.action);
    case 'practice-lock':
      return { ...timed, locked: true, routines: { ...timed.routines, lockPracticed: true } };
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

function transitionLogin(
  state: Extract<GameState, { phase: 'login' }>,
  intent: Intent,
  now: number,
  config: GameConfig,
): GameState {
  switch (intent.type) {
    case 'login': {
      const loginCategory = passwordCategory(intent.password, config);
      if (loginCategory === null) {
        return { ...state, now, failedAttempts: Math.min(3, state.failedAttempts + 1) };
      }
      return {
        phase: 'session',
        generation: state.generation,
        now,
        startedAt: now,
        deadline: now + config.sessionDurationMs,
        calm: config.defaultCalmMode,
        loginCategory,
        mode: 'free',
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
        pendingIncident: null,
      };
    }
    case 'logout':
      return loginState(state.generation + 1, now, 'logout');
    case 'tick':
    case 'continue':
    case 'open':
    case 'finish-experience':
    case 'begin-decision':
    case 'choose':
    case 'close':
    case 'calm':
    case 'debrief':
    case 'answer-check':
    case 'activity':
    case 'routine':
    case 'practice-lock':
    case 'resume-lock':
    case 'dismiss-idle':
      return { ...state, now };
    default:
      return assertNever(intent);
  }
}

function passwordCategory(
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
  const index = config.acceptedPasswords.findIndex(
    (candidate) => typeof candidate === 'string' && normalize(candidate) === entered,
  );
  if (index < 0) return null;
  return index === 0 ? 'displayed' : 'weak';
}

function continueScene(
  state: Extract<GameState, { phase: 'session' }>,
  config: GameConfig,
): GameState {
  switch (state.scene.kind) {
    case 'intro':
      return state.mode === 'guided'
        ? advanceGuided(state)
        : { ...state, scene: { kind: 'desktop' } };
    case 'feedback':
      if (state.mode === 'guided') return advanceGuided(state);
      if (
        state.scene.result.id === 'usb' &&
        state.scene.result.outcome === 'risky' &&
        !hasResult(state, 'incident')
      ) {
        return openChallenge({ ...state, scene: { kind: 'desktop' } }, 'incident', config);
      }
      return allComplete(state)
        ? { ...state, scene: { kind: 'debrief' } }
        : { ...state, scene: { kind: 'desktop' } };
    case 'routines':
      return { ...state, scene: { kind: 'debrief' } };
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
  config: GameConfig,
): GameState {
  if (!isChallengeId(id) || hasResult(state, id) || state.mode === 'guided') return state;
  const available =
    state.scene.kind === 'desktop'
      ? state
      : state.scene.kind === 'challenge'
        ? leaveFreeChallenge(state)
        : state;
  if (available.scene.kind !== 'desktop') return state;
  if (id === 'incident' && available.pendingIncident !== null) {
    return {
      ...available,
      pendingIncident: null,
      scene: { kind: 'challenge', id, ...available.pendingIncident, step: 'notify' },
    };
  }
  const scene: Scene = {
    kind: 'challenge',
    id,
    startedAt: available.now,
    exploreUntil: available.now + config.explorationDurationMs,
    deadline: null,
    step: 'explore',
  };
  return { ...available, scene };
}

/**
 * Continue the active situation before filling gaps in the fixed guided order.
 * Preserve an incident's isolation progress so the player is asked to report it,
 * rather than repeating isolation. Guided play deliberately clears local timing;
 * transition settles an already-expired attempt before this function is reached.
 */
function finishExperience(state: Extract<GameState, { phase: 'session' }>): GameState {
  if (state.mode === 'guided') return state;
  const pendingIncident =
    state.scene.kind === 'challenge' &&
    state.scene.id === 'incident' &&
    state.scene.step === 'notify'
      ? {
          startedAt: state.scene.startedAt,
          exploreUntil: state.scene.exploreUntil,
          deadline: null,
        }
      : state.pendingIncident === null
        ? null
        : { ...state.pendingIncident, deadline: null };
  const preferred =
    state.scene.kind === 'challenge' && !hasResult(state, state.scene.id)
      ? state.scene.id
      : nextUnanswered(state);
  const guided = { ...state, mode: 'guided' as const, pendingIncident };
  // Local deadlines are removed before guided progress resumes; the session deadline
  // comes from the unchanged state spread above.
  return preferred === null ? completeGuided(guided) : openGuidedChallenge(guided, preferred);
}

function openGuidedChallenge(
  state: Extract<GameState, { phase: 'session' }>,
  id: ChallengeId,
): GameState {
  if (id === 'incident' && state.pendingIncident !== null) {
    return {
      ...state,
      pendingIncident: null,
      scene: {
        kind: 'challenge',
        id,
        startedAt: state.pendingIncident.startedAt,
        exploreUntil: state.pendingIncident.exploreUntil,
        deadline: null,
        step: 'notify',
      },
    };
  }
  const scene: Scene = {
    kind: 'challenge',
    id,
    startedAt: state.now,
    exploreUntil: state.now,
    deadline: null,
    // The sender demonstration needs its compose/preview interaction before acknowledgement.
    step: id === 'spoof' ? 'explore' : 'choose',
  };
  return { ...state, scene };
}

function advanceGuided(state: Extract<GameState, { phase: 'session' }>): GameState {
  const next = nextUnanswered(state);
  return next === null ? completeGuided(state) : openGuidedChallenge(state, next);
}

function completeGuided(state: Extract<GameState, { phase: 'session' }>): GameState {
  return { ...state, scene: routinesComplete(state) ? { kind: 'debrief' } : { kind: 'routines' } };
}

function beginDecision(
  state: Extract<GameState, { phase: 'session' }>,
  config: GameConfig,
): GameState {
  const scene = state.scene;
  if (scene.kind !== 'challenge' || scene.step !== 'explore') return state;
  return {
    ...state,
    scene: {
      ...scene,
      step: 'choose',
      deadline: challengeDeadline(state, scene.id, config),
    },
  };
}

function choose(
  state: Extract<GameState, { phase: 'session' }>,
  choiceId: string,
  config: GameConfig,
): GameState {
  const scene = state.scene;
  if (scene.kind !== 'challenge' || hasResult(state, scene.id)) return state;
  if (typeof choiceId !== 'string') return state;
  // Native surfaces can emit choices during exploration (for example opening the
  // USB file). The action drawer is one input path, not a mandatory permission gate.
  const outcome = choiceOutcome(scene.id, scene.step === 'notify' ? 'notify' : 'choose', choiceId);
  if (outcome === null) return state;

  // Isolation is only the first half of the response. Reporting must complete the
  // situation, and moving to that step does not grant a fresh decision-time budget.
  if (scene.id === 'incident' && scene.step === 'choose' && choiceId === 'isolate') {
    return { ...state, scene: { ...scene, step: 'notify' } };
  }
  if (scene.id === 'incident' && scene.step === 'explore' && choiceId === 'isolate') {
    return {
      ...state,
      scene: { ...scene, step: 'notify', deadline: challengeDeadline(state, scene.id, config) },
    };
  }
  return recordResult(state, { id: scene.id, outcome, choiceId });
}

/**
 * First outcome wins, including timeout: re-opening or duplicate clicks cannot
 * replace a learning consequence with a better score. The hasResult guard protects
 * insertion; duplicate-result journeys in packages/core/tests/game.test.ts exercise it.
 */
function recordResult(
  state: Extract<GameState, { phase: 'session' }>,
  result: ChallengeResult,
): GameState {
  if (hasResult(state, result.id)) return state;
  return {
    ...state,
    results: [...state.results, result],
    usbInfected: state.usbInfected || (result.id === 'usb' && result.outcome === 'risky'),
    scene: { kind: 'feedback', result },
  };
}

function closeScene(state: Extract<GameState, { phase: 'session' }>): GameState {
  if (state.mode === 'free' && state.scene.kind === 'challenge') return leaveFreeChallenge(state);
  if (state.scene.kind === 'debrief' && !allComplete(state)) {
    return { ...state, scene: { kind: 'desktop' } };
  }
  return state;
}

/**
 * Ordinary exploration attempts can be abandoned. An isolated incident instead
 * leaves a reporting obligation, with its timing, in pendingIncident. Minimizing
 * is different: Session.svelte hides the view without sending a close command.
 */
function leaveFreeChallenge(
  state: Extract<GameState, { phase: 'session' }>,
): Extract<GameState, { phase: 'session' }> {
  if (state.scene.kind !== 'challenge') return state;
  const pendingIncident =
    state.scene.id === 'incident' && state.scene.step === 'notify'
      ? {
          startedAt: state.scene.startedAt,
          exploreUntil: state.scene.exploreUntil,
          deadline: state.scene.deadline,
        }
      : state.pendingIncident;
  return { ...state, pendingIncident, scene: { kind: 'desktop' } };
}

function setCalm(state: Extract<GameState, { phase: 'session' }>, enabled: boolean): GameState {
  if (typeof enabled !== 'boolean') return state;
  if (state.scene.kind === 'challenge') {
    // Relaxing the active timer is allowed; arming one mid-situation would surprise
    // a player who began reading without a deadline.
    if (!enabled) return state;
    return {
      ...state,
      calm: true,
      pendingIncident:
        state.pendingIncident === null ? null : { ...state.pendingIncident, deadline: null },
      scene: { ...state.scene, deadline: null },
    };
  }
  if (enabled) {
    return {
      ...state,
      calm: true,
      pendingIncident:
        state.pendingIncident === null ? null : { ...state.pendingIncident, deadline: null },
    };
  }
  return { ...state, calm: enabled };
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
    case 'resume-lock':
      return { ...state, locked: false };
    case 'logout':
      return loginState(state.generation + 1, state.now, 'logout');
    case 'login':
    case 'continue':
    case 'open':
    case 'finish-experience':
    case 'begin-decision':
    case 'choose':
    case 'close':
    case 'calm':
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

function challengeDeadline(
  state: Extract<GameState, { phase: 'session' }>,
  id: ChallengeId,
  config: GameConfig,
): number | null {
  return state.mode === 'guided' || state.calm || id === 'spoof'
    ? null
    : state.now + config.challengeDurationMs;
}

function recordActivity(state: Extract<GameState, { phase: 'session' }>): GameState {
  return {
    ...state,
    routines: { ...state.routines, lastActivityAt: state.now, idleDismissed: false },
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
  return (
    state.routines.password === 'done' &&
    state.routines.update === 'scheduled' &&
    state.routines.lockPracticed
  );
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

function loginState(
  generation: number,
  now: number,
  reason: Extract<GameState, { phase: 'login' }>['reason'],
): GameState {
  return { phase: 'login', generation, now, reason, failedAttempts: 0 };
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
