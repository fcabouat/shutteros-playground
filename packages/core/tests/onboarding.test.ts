import { describe, expect, expectTypeOf, it } from 'vitest';
import type { GameConfig } from '../src/model/configuration';
import {
  guidanceDelayMs,
  type GameState,
  type GuidanceLevel,
  type Intent,
  type PlayMode,
} from '../src/model/game';
import { debriefStats, guidanceLevel, journeySummary, safeCount } from '../src/projections/game';
import { initialState, transition } from '../src/runtime/game';
import { loginChoiceOutcome } from '../src/services/passwords';

const config: GameConfig = {
  sessionDurationMs: 1_800_000,
  idleReminderMs: 300_000,
  eventIntervalMs: 300_000,
  acceptedPasswords: ['Bureau2026'],
  caseSensitivePasswords: false,
  showPasswordHint: true,
  passwordManagerName: 'KeePassXC',
  organizationName: 'Org',
  playerName: 'Jules',
  supportLabel: 'Support',
  supportContact: '01 02 03 04 05',
  stationLabel: 'Borne',
  mailLegitimateAddress: 'equipe@organisation.example',
  mailImpersonatorAddress: 'usurpateur@externe.example',
};

function apply(state: GameState, intent: Intent, now: number): GameState {
  return transition(state, intent, now, config);
}

function login(mode: PlayMode = 'guided', now = 0): Extract<GameState, { phase: 'login' }> {
  let state = apply(initialState(now), { type: 'set-mode', mode }, now);
  state = apply(state, { type: 'begin' }, now);
  if (state.phase !== 'login') throw new Error('Expected login');
  return state;
}

function session(mode: PlayMode = 'free', now = 0): Extract<GameState, { phase: 'session' }> {
  const state = apply(login(mode, now), { type: 'login', password: 'Bureau2026' }, now);
  if (state.phase !== 'session') throw new Error('Expected session');
  return state;
}

describe('play mode onboarding', () => {
  it('exposes one optional hint level and no questionnaire request intent', () => {
    expectTypeOf<GuidanceLevel>().toEqualTypeOf<0 | 1>();
    expectTypeOf<Extract<Intent, { type: 'request-choices' }>>().toEqualTypeOf<never>();
  });

  it('starts at an unlimited welcome and requires begin before either login path', () => {
    const welcome = apply(initialState(10), { type: 'tick' }, 9_000_000);
    expect(welcome).toEqual({
      phase: 'welcome',
      generation: 0,
      now: 9_000_000,
      reason: 'initial',
      mode: 'guided',
    });
    expect(apply(welcome, { type: 'login', password: 'Bureau2026' }, 9_000_001)).toMatchObject({
      phase: 'welcome',
    });
    expect(apply(welcome, { type: 'answer-login', choiceId: 'manager' }, 9_000_001)).toMatchObject({
      phase: 'welcome',
    });
  });

  it('inherits the selected mode and starts the session clock only after login', () => {
    const entered = login('free', 500_000);
    expect(entered).toMatchObject({ mode: 'free', journey: { modes: ['free'], hints: [] } });
    const state = apply(entered, { type: 'login', password: 'Bureau2026' }, 700_000);
    expect(state).toMatchObject({
      phase: 'session',
      mode: 'free',
      startedAt: 700_000,
      deadline: 2_500_000,
      journey: { modes: ['free'] },
    });
  });

  it('accepts the questionnaire only in guided mode and retains its answer', () => {
    const answered = apply(login(), { type: 'answer-login', choiceId: 'manager' }, 25);
    expect(answered).toMatchObject({
      phase: 'session',
      loginCategory: 'guided',
      loginChoiceId: 'manager',
      mode: 'guided',
      scene: { kind: 'intro' },
    });
    expect(apply(login('free'), { type: 'answer-login', choiceId: 'note' }, 25)).toMatchObject({
      phase: 'login',
    });
    expect(
      apply(login(), { type: 'answer-login', choiceId: 'constructor' as never }, 25),
    ).toMatchObject({ phase: 'login' });
    expect(apply(login(), { type: 'login', password: 'Bureau2026' }, 25)).toMatchObject({
      phase: 'session',
      loginCategory: 'displayed',
      mode: 'guided',
    });
    expect(loginChoiceOutcome('manager')).toBe('safe');
    expect(loginChoiceOutcome('note')).toBe('risky');
    expect(loginChoiceOutcome('file')).toBe('risky');
    expect(loginChoiceOutcome('constructor')).toBeNull();
  });

  it('switches modes without skipping explanations, routines, or the recap', () => {
    const feedback = {
      ...session('free'),
      scene: {
        kind: 'feedback' as const,
        replay: false,
        result: { id: 'web' as const, outcome: 'safe' as const, choiceId: 'known-address' },
      },
      results: [{ id: 'web' as const, outcome: 'safe' as const, choiceId: 'known-address' }],
    };
    expect(apply(feedback, { type: 'set-mode', mode: 'guided' }, 1)).toMatchObject({
      mode: 'guided',
      scene: { kind: 'feedback' },
    });
    for (const kind of ['intro', 'routines', 'debrief'] as const) {
      const state = { ...session('free'), scene: { kind } };
      expect(apply(state, { type: 'set-mode', mode: 'guided' }, 1)).toMatchObject({
        mode: 'guided',
        scene: { kind },
      });
    }
  });

  it('changes choice presentation through mode without changing the step or hint', () => {
    let state = apply(
      apply(session('free'), { type: 'continue' }, 1),
      { type: 'open', id: 'incident' },
      2,
    );
    state = apply(state, { type: 'choose', choiceId: 'isolate' }, 3);
    state = apply(state, { type: 'set-mode', mode: 'guided' }, 4);
    expect(state).toMatchObject({ scene: { kind: 'challenge', id: 'incident', step: 'notify' } });
    expect(guidanceLevel(state)).toBe(0);
    state = apply(state, { type: 'request-hint' }, 5);
    expect(guidanceLevel(state)).toBe(1);
    state = apply(state, { type: 'set-mode', mode: 'free' }, 6);
    expect(guidanceLevel(state)).toBe(1);
    expect(journeySummary(state)).toEqual({
      mode: 'mixed',
      modes: ['free', 'guided', 'free'],
      hints: [],
      hintCount: 0,
      challengeHintCount: 0,
      challengeHintTotal: 8,
    });
  });

  it('records the return to free exploration from a guided recap', () => {
    const state: GameState = { ...session('guided'), scene: { kind: 'debrief' } };
    const resumed = apply(state, { type: 'close' }, 1);
    expect(resumed).toMatchObject({ mode: 'free', scene: { kind: 'desktop' } });
    expect(journeySummary(resumed)?.mode).toBe('mixed');
    expect(resumed).toMatchObject({ deadline: state.deadline, results: state.results });
  });

  it('records only help actually viewed, once per context', () => {
    let loginState: GameState = login('free');
    loginState = apply(loginState, { type: 'hint-viewed' }, 1);
    expect(loginState).toMatchObject({ journey: { hints: [] } });
    loginState = apply(loginState, { type: 'request-hint' }, 2);
    loginState = apply(loginState, { type: 'hint-viewed' }, 3);
    loginState = apply(loginState, { type: 'hint-viewed' }, 4);
    expect(loginState).toMatchObject({ journey: { hints: ['login'] } });

    let state = apply(
      apply(session('free'), { type: 'continue' }, 1),
      { type: 'open', id: 'incident' },
      2,
    );
    state = apply(state, { type: 'request-hint' }, 3);
    state = apply(state, { type: 'hint-viewed' }, 4);
    expect(state).toMatchObject({ journey: { hints: ['incident:choose'] } });
    state = apply(state, { type: 'set-mode', mode: 'free' }, 5);
    state = apply(state, { type: 'choose', choiceId: 'isolate' }, 6);
    state = apply(state, { type: 'request-hint' }, 7);
    state = apply(state, { type: 'hint-viewed' }, 8);
    state = apply(state, { type: 'hint-viewed' }, 9);
    expect(state).toMatchObject({
      journey: { hints: ['incident:choose', 'incident:notify'] },
    });

    let guided: GameState = apply(session('guided'), { type: 'continue' }, 1);
    expect(guided).toMatchObject({ journey: { hints: [] } });
    guided = apply(guided, { type: 'hint-viewed' }, 2);
    expect(guided).toMatchObject({ journey: { hints: [] } });
    guided = apply(guided, { type: 'request-hint' }, 3);
    guided = apply(guided, { type: 'hint-viewed' }, 4);
    expect(guided).toMatchObject({ journey: { hints: ['usb:choose'] } });
  });

  it('times and deduplicates a hint first viewed during replay without replacing the result', () => {
    const firstResults = [{ id: 'usb' as const, outcome: 'safe' as const, choiceId: 'eject' }];
    let state: GameState = {
      ...apply(session('free'), { type: 'continue' }, 1),
      results: firstResults,
    };
    state = apply(state, { type: 'open', id: 'usb' }, 2);
    expect(guidanceLevel(apply(state, { type: 'tick' }, 2 + guidanceDelayMs - 1))).toBe(0);
    state = apply(state, { type: 'tick' }, 2 + guidanceDelayMs);
    expect(guidanceLevel(state)).toBe(1);
    state = apply(state, { type: 'hint-viewed' }, 2 + guidanceDelayMs + 1);
    state = apply(state, { type: 'hint-viewed' }, 2 + guidanceDelayMs + 2);
    expect(state).toMatchObject({
      journey: { hints: ['usb:choose'] },
      results: firstResults,
    });
    state = apply(state, { type: 'choose', choiceId: 'open' }, 2 + guidanceDelayMs + 3);
    expect(state).toMatchObject({
      results: firstResults,
      scene: { kind: 'feedback', replay: true, result: { outcome: 'risky' } },
    });
  });

  it('keeps help out of scores and exposes factual recap statistics', () => {
    const state = {
      ...session('free'),
      journey: { modes: ['free'] as const, hints: ['usb:choose'] },
      results: [
        { id: 'usb' as const, outcome: 'safe' as const, choiceId: 'report' },
        { id: 'mfa' as const, outcome: 'safe' as const, choiceId: 'deny-report' },
      ],
      routines: {
        ...session('free').routines,
        password: 'done' as const,
        update: 'scheduled' as const,
        lockPracticed: true,
      },
    };
    expect(safeCount(state)).toBe(2);
    expect(debriefStats(state)).toEqual({
      activitiesCompleted: 2,
      activitiesTotal: 7,
      dailyHabitsCompleted: 3,
      dailyHabitsTotal: 3,
      reportsMade: 1,
      reportsEligible: 4,
      workstationProtected: true,
    });
    expect(journeySummary(state)).toMatchObject({
      hintCount: 1,
      challengeHintCount: 1,
      challengeHintTotal: 8,
    });
  });

  it('keeps the login hint outside the activity-hint denominator', () => {
    const state = {
      ...session('free'),
      journey: { modes: ['free'] as const, hints: ['login', 'incident:notify'] },
    };
    expect(journeySummary(state)).toMatchObject({
      hintCount: 2,
      challengeHintCount: 1,
      challengeHintTotal: 8,
    });
  });

  it('returns to a clean guided welcome on logout and expiry', () => {
    const active = session('free', 100);
    expect(apply(active, { type: 'logout' }, 200)).toEqual({
      phase: 'welcome',
      generation: 1,
      now: 200,
      reason: 'logout',
      mode: 'guided',
    });
    expect(apply(active, { type: 'tick' }, 1_800_100)).toEqual({
      phase: 'welcome',
      generation: 1,
      now: 1_800_100,
      reason: 'expired',
      mode: 'guided',
    });
  });
});
