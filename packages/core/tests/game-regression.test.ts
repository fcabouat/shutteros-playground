import { describe, expect, it } from 'vitest';
import type { GameConfig } from '../src/model/configuration';
import type { GameState, Intent } from '../src/model/game';
import { incidentFollowsFeedback, incidentIsolated } from '../src/projections/game';
import { initialState, transition } from '../src/runtime/game';
import { passwordHint } from '../src/services/passwords';

const config: GameConfig = {
  sessionDurationMs: 60_000,
  idleReminderMs: 5_000,
  eventIntervalMs: 10_000,
  acceptedPasswords: [' Accès ', 'Café'],
  caseSensitivePasswords: false,
  showPasswordHint: false,
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

function session(now = 0): Extract<GameState, { phase: 'session' }> {
  const loggedIn = apply(initialState(now), { type: 'login', password: 'accès' }, now);
  if (loggedIn.phase !== 'session') throw new Error('Expected session');
  return loggedIn;
}

function desktop(now = 0): Extract<GameState, { phase: 'session' }> {
  const ready = apply(session(now), { type: 'continue' }, now);
  if (ready.phase !== 'session' || ready.scene.kind !== 'desktop')
    throw new Error('Expected desktop');
  return ready;
}

describe('game runtime regressions', () => {
  it('normalizes passwords and retains only their learning category', () => {
    const displayed = apply(initialState(), { type: 'login', password: '  ACCÈS  ' }, 1);
    expect(displayed).toMatchObject({ phase: 'session', loginCategory: 'displayed' });
    expect(displayed).not.toHaveProperty('password');
    expect(apply(initialState(), { type: 'login', password: 'café' }, 1)).toMatchObject({
      phase: 'session',
      loginCategory: 'weak',
    });
    expect(
      transition(initialState(), { type: 'login', password: 'accès' }, 1, {
        ...config,
        caseSensitivePasswords: true,
      }),
    ).toMatchObject({ phase: 'login', failedAttempts: 1 });
  });

  it('classifies configured translations and never accepts an unconfigured one', () => {
    const bilingual = { ...config, acceptedPasswords: ['Bureau2026', 'Office2026', 'password'] };
    for (const password of [' bureau2026 ', ' OFFICE2026 ']) {
      expect(transition(initialState(), { type: 'login', password }, 1, bilingual)).toMatchObject({
        phase: 'session',
        loginCategory: 'displayed',
      });
    }
    expect(passwordHint(bilingual, 'fr')).toBe('Bureau2026');
    expect(passwordHint(bilingual, 'en')).toBe('Office2026');
    const legacy = { ...config, acceptedPasswords: ['Bureau2026'] };
    expect(
      transition(initialState(), { type: 'login', password: 'Office2026' }, 1, legacy),
    ).toMatchObject({
      phase: 'login',
      failedAttempts: 1,
    });
  });

  it('keeps time finite and monotonic for stale or invalid host samples', () => {
    expect(initialState(Number.NaN)).toMatchObject({ now: 0 });
    const state = apply(session(100), { type: 'tick' }, 160);
    expect(apply(state, { type: 'tick' }, 120).now).toBe(160);
    expect(apply(state, { type: 'tick' }, Number.NaN).now).toBe(160);
    expect(apply(state, { type: 'tick' }, Number.POSITIVE_INFINITY).now).toBe(160);
  });

  it('clears all session information on logout and expiry', () => {
    const opened = apply(desktop(), { type: 'open', id: 'usb' }, 2);
    const loggedOut = apply(opened, { type: 'logout' }, 3);
    expect(loggedOut).toMatchObject({
      phase: 'login',
      generation: 1,
      now: 3,
      reason: 'logout',
      failedAttempts: 0,
    });
    expect(loggedOut).not.toHaveProperty('results');
    expect(apply(opened, { type: 'choose', choiceId: 'eject' }, 60_000)).toMatchObject({
      phase: 'login',
      reason: 'expired',
    });
  });

  it('expires a locked session at its exact global deadline', () => {
    const locked = apply(
      apply(desktop(), { type: 'open', id: 'web' }, 1),
      { type: 'practice-lock' },
      2,
    );
    expect(apply(locked, { type: 'choose', choiceId: 'known-address' }, 10_000)).toMatchObject({
      locked: true,
      results: [],
    });
    expect(apply(locked, { type: 'tick' }, 60_000)).toMatchObject({
      phase: 'login',
      reason: 'expired',
    });
  });

  it('records USB infection once and chains only first-attempt risky feedback', () => {
    const usb = apply(desktop(), { type: 'open', id: 'usb' }, 1);
    const feedback = apply(usb, { type: 'choose', choiceId: 'open' }, 2);
    expect(feedback).toMatchObject({
      usbInfected: true,
      results: [{ id: 'usb', outcome: 'risky', choiceId: 'open' }],
    });
    if (feedback.phase !== 'session' || feedback.scene.kind !== 'feedback') throw new Error();
    expect(incidentFollowsFeedback(feedback, feedback.scene.result)).toBe(true);
    expect(apply(feedback, { type: 'continue' }, 3)).toMatchObject({
      scene: { kind: 'challenge', id: 'incident', step: 'choose' },
    });
  });

  it('rejects unknown, inherited, and malformed action identifiers', () => {
    const opened = apply(desktop(), { type: 'open', id: 'usb' }, 1);
    for (const choiceId of ['bad-id', 'constructor', 'toString']) {
      expect(apply(opened, { type: 'choose', choiceId }, 2)).toEqual({ ...opened, now: 2 });
    }
    expect(apply(opened, { type: 'choose', choiceId: {} as never }, 2)).toEqual({
      ...opened,
      now: 2,
    });
    expect(apply(desktop(), { type: 'open', id: 'unknown' as never }, 2)).toMatchObject({
      scene: { kind: 'desktop' },
    });
  });

  it('keeps an isolated incident pending across activity switches', () => {
    let state = apply(desktop(), { type: 'open', id: 'incident' }, 1);
    state = apply(state, { type: 'choose', choiceId: 'isolate' }, 2);
    state = apply(state, { type: 'open', id: 'mail' }, 3);
    expect(incidentIsolated(state)).toBe(true);
    state = apply(state, { type: 'open', id: 'incident' }, 4);
    expect(state).toMatchObject({ scene: { step: 'notify', priorChoiceId: 'isolate' } });
  });

  it('does not treat isolation in a replay as outstanding first-attempt work', () => {
    const prior = {
      ...desktop(),
      results: [{ id: 'incident', outcome: 'risky', choiceId: 'restart' }],
    } as const;
    let replay = apply(prior, { type: 'open', id: 'incident' }, 1);
    replay = apply(replay, { type: 'choose', choiceId: 'isolate' }, 2);
    expect(incidentIsolated(replay)).toBe(false);
    replay = apply(replay, { type: 'open', id: 'mail' }, 3);
    expect(incidentIsolated(replay)).toBe(false);
  });

  it('evaluates optional knowledge before expiry and rejects duplicate or late answers', () => {
    const state = apply(
      { ...desktop(), scene: { kind: 'routines' } },
      { type: 'routine', id: 'password', action: 'complete' },
      2,
    );
    const answered = apply(state, { type: 'answer-check', answerId: 'replace-now' }, 3);
    expect(answered).toMatchObject({ knowledge: [{ id: 'password', correct: true }] });
    expect(apply(answered, { type: 'answer-check', answerId: 'wait-cycle' }, 4)).toEqual({
      ...answered,
      now: 4,
    });
    expect(apply(state, { type: 'answer-check', answerId: 'replace-now' }, 60_000)).toMatchObject({
      phase: 'login',
      reason: 'expired',
    });
  });

  it('keeps first results and side effects when a completed activity is replayed', () => {
    const original = {
      ...desktop(),
      results: [{ id: 'usb', choiceId: 'eject', outcome: 'safe' }],
    } as const;
    const replay = apply(original, { type: 'open', id: 'usb' }, 10);
    const feedback = apply(replay, { type: 'choose', choiceId: 'open' }, 11);
    expect(feedback).toMatchObject({
      results: original.results,
      usbInfected: false,
      scene: { kind: 'feedback', replay: true, result: { outcome: 'risky' } },
    });
  });

  it('updates independent routine outcomes without reversing completed work', () => {
    let state = apply(desktop(), { type: 'routine', id: 'password', action: 'later' }, 1);
    state = apply(state, { type: 'routine', id: 'password', action: 'complete' }, 2);
    state = apply(state, { type: 'routine', id: 'update', action: 'complete' }, 3);
    expect(state).toMatchObject({ routines: { password: 'done', update: 'scheduled' } });
    expect(apply(state, { type: 'routine', id: 'update', action: 'later' }, 4)).toEqual({
      ...state,
      now: 4,
    });
  });
});
