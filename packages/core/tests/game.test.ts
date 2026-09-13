import { describe, expect, it } from 'vitest';
import type { GameConfig } from '../src/model/configuration';
import { challengeChoiceIds, choiceOutcome, type GameState, type Intent } from '../src/model/game';
import {
  allComplete,
  actionDockStartsOpen,
  ambientSlot,
  assessedCount,
  explorationReady,
  hasResult,
  incidentFollowsFeedback,
  incidentIsolated,
  idleReminderVisible,
  nextAmbientEvent,
  safeCount,
} from '../src/projections/game';
import { initialState, transition } from '../src/runtime/game';
import { passwordHint } from '../src/services/passwords';

const config: GameConfig = {
  sessionDurationMs: 60_000,
  explorationDurationMs: 2_000,
  idleReminderMs: 5_000,
  eventIntervalMs: 10_000,
  acceptedPasswords: [' Accès ', 'Café'],
  caseSensitivePasswords: false,
  showPasswordHint: false,
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

function session(now = 0): Extract<GameState, { phase: 'session' }> {
  const loggedIn = apply(initialState(now), { type: 'login', password: 'accès' }, now);
  if (loggedIn.phase !== 'session') throw new Error('Expected a session');
  return loggedIn;
}

function desktop(now = 0): Extract<GameState, { phase: 'session' }> {
  const state = apply(session(now), { type: 'continue' }, now);
  if (state.phase !== 'session' || state.scene.kind !== 'desktop')
    throw new Error('Expected desktop');
  return state;
}

describe('game runtime', () => {
  it('offers help after three failed logins and clears attempts for the next player', () => {
    let state = initialState();
    for (const attempt of [1, 2, 3, 3]) {
      state = apply(state, { type: 'login', password: 'wrong' }, 1);
      expect(state).toMatchObject({ phase: 'login', failedAttempts: attempt });
    }
    state = apply(state, { type: 'login', password: 'accès' }, 2);
    expect(state.phase).toBe('session');
    expect(apply(state, { type: 'logout' }, 3)).toMatchObject({
      phase: 'login',
      failedAttempts: 0,
    });
  });

  it('normalizes passwords and retains only their learning category after login', () => {
    const displayed = apply(initialState(), { type: 'login', password: '  ACCÈS  ' }, 1);
    expect(displayed).toMatchObject({ phase: 'session', loginCategory: 'displayed' });
    expect(displayed).not.toHaveProperty('password');
    const weak = apply(initialState(), { type: 'login', password: 'café' }, 1);
    expect(weak).toMatchObject({ phase: 'session', loginCategory: 'weak' });
    const sensitive = { ...config, caseSensitivePasswords: true };
    expect(
      transition(initialState(), { type: 'login', password: 'accès' }, 1, sensitive),
    ).toMatchObject({
      phase: 'login',
      failedAttempts: 1,
    });
  });

  it('classifies both configured demo translations as the exposed note', () => {
    const bilingual = { ...config, acceptedPasswords: ['Bureau2026', 'Office2026', 'password'] };
    for (const password of [' bureau2026 ', ' OFFICE2026 ']) {
      expect(transition(initialState(), { type: 'login', password }, 1, bilingual)).toMatchObject({
        phase: 'session',
        loginCategory: 'displayed',
      });
    }
    expect(passwordHint(bilingual, 'fr')).toBe('Bureau2026');
    expect(passwordHint(bilingual, 'en')).toBe('Office2026');
  });

  it('preserves custom notes and never accepts an unconfigured translation', () => {
    const custom = { ...config, acceptedPasswords: ['Invitation', 'Bureau2026', 'Office2026'] };
    expect(passwordHint(custom, 'en')).toBe('Invitation');
    expect(
      transition(initialState(), { type: 'login', password: 'Office2026' }, 1, custom),
    ).toMatchObject({ phase: 'session', loginCategory: 'weak' });
    const legacy = { ...config, acceptedPasswords: ['Bureau2026'] };
    expect(passwordHint(legacy, 'en')).toBe('Bureau2026');
    expect(
      transition(initialState(), { type: 'login', password: 'Office2026' }, 1, legacy),
    ).toMatchObject({ phase: 'login', failedAttempts: 1 });
  });

  it('expires the whole session before applying an action at its exact deadline', () => {
    const state = desktop(5);
    const expired = apply(state, { type: 'open', id: 'usb' }, 60_005);
    expect(expired).toEqual({
      phase: 'login',
      generation: 1,
      now: 60_005,
      reason: 'expired',
      failedAttempts: 0,
    });
  });

  it('allows an explicit logout during a challenge', () => {
    const opened = apply(desktop(), { type: 'open', id: 'usb' }, 5);
    expect(apply(opened, { type: 'logout' }, 10_005)).toEqual({
      phase: 'login',
      generation: 1,
      now: 10_005,
      reason: 'logout',
      failedAttempts: 0,
    });
  });

  it('opens discovery surfaces first and reveals choices when requested', () => {
    const exploring = apply(desktop(), { type: 'open', id: 'web' }, 10);
    expect(exploring).toMatchObject({
      phase: 'session',
      scene: {
        kind: 'challenge',
        id: 'web',
        step: 'explore',
        startedAt: 10,
        exploreUntil: 2_010,
      },
    });
    expect(explorationReady(exploring)).toBe(false);
    if (exploring.phase === 'session' && exploring.scene.kind === 'challenge') {
      expect(actionDockStartsOpen(exploring.scene)).toBe(false);
    }
    expect(explorationReady(apply(exploring, { type: 'tick' }, 2_010))).toBe(true);

    const deciding = apply(exploring, { type: 'begin-decision' }, 11);
    expect(deciding).toMatchObject({
      phase: 'session',
      scene: { kind: 'challenge', step: 'choose' },
    });
    const spoof = apply(desktop(), { type: 'open', id: 'spoof' }, 20);
    expect(apply(spoof, { type: 'begin-decision' }, 21)).toMatchObject({
      phase: 'session',
      scene: { kind: 'challenge', id: 'spoof', step: 'choose' },
    });
    const mfa = apply(desktop(), { type: 'open', id: 'mfa' }, 30);
    if (mfa.phase === 'session' && mfa.scene.kind === 'challenge') {
      expect(actionDockStartsOpen(mfa.scene)).toBe(true);
      expect(mfa.scene).toMatchObject({ step: 'choose' });
    }
  });

  it('accepts native exploration choices and opens reporting after isolation', () => {
    const web = apply(desktop(), { type: 'open', id: 'web' }, 1);
    expect(apply(web, { type: 'choose', choiceId: 'known-address' }, 2)).toMatchObject({
      phase: 'session',
      scene: { kind: 'feedback', result: { id: 'web', outcome: 'safe' } },
    });
    const incident = apply(desktop(), { type: 'open', id: 'incident' }, 10);
    expect(apply(incident, { type: 'choose', choiceId: 'isolate' }, 20)).toMatchObject({
      phase: 'session',
      scene: { kind: 'challenge', step: 'notify' },
    });
  });

  it('keeps time monotonic when a stale clock is supplied', () => {
    const state = apply(session(100), { type: 'tick' }, 160);
    expect(apply(state, { type: 'tick' }, 120).now).toBe(160);
  });

  it('keeps a finite monotonic clock when a host supplies a non-finite timestamp', () => {
    expect(initialState(Number.NaN)).toMatchObject({ phase: 'login', now: 0 });
    const state = apply(session(100), { type: 'tick' }, 160);
    expect(apply(state, { type: 'tick' }, Number.NaN).now).toBe(160);
    expect(apply(state, { type: 'tick' }, Number.POSITIVE_INFINITY).now).toBe(160);
  });

  it('starts a new hint delay when reopening free exploration', () => {
    const exploring = apply(desktop(), { type: 'open', id: 'mail' }, 10);
    const opened = apply(exploring, { type: 'begin-decision' }, 10);
    expect(opened.phase === 'session' && opened.scene).toMatchObject({
      kind: 'challenge',
    });
    const close = apply(opened, { type: 'close' }, 20);
    expect(close).toMatchObject({
      phase: 'session',
      scene: { kind: 'desktop' },
    });
    const reopen = apply(close, { type: 'open', id: 'mail' }, 30);
    expect(reopen).toMatchObject({
      phase: 'session',
      scene: { kind: 'challenge', step: 'explore', exploreUntil: 2_030 },
    });
  });

  it('clears all session information on logout', () => {
    const state = apply(desktop(), { type: 'open', id: 'usb' }, 2);
    const loggedOut = apply(state, { type: 'logout' }, 3);
    expect(loggedOut).toEqual({
      phase: 'login',
      generation: 1,
      now: 3,
      reason: 'logout',
      failedAttempts: 0,
    });
  });

  it('records an optional wrong password check after the password routine in mail', () => {
    const onDesktop = apply(session(), { type: 'continue' }, 1);
    const mail = apply(onDesktop, { type: 'open', id: 'mail' }, 2);
    const completed = apply(mail, { type: 'routine', id: 'password', action: 'complete' }, 3);
    const checked = apply(completed, { type: 'answer-check', answerId: 'wait-cycle' }, 4);
    expect(checked).toMatchObject({
      phase: 'session',
      scene: { kind: 'challenge', id: 'mail' },
      knowledge: [{ id: 'password', answerId: 'wait-cycle', correct: false }],
    });
    const feedback = apply(checked, { type: 'choose', choiceId: 'verify' }, 5);
    const continued = apply(feedback, { type: 'continue' }, 6);
    expect(continued).toMatchObject({
      phase: 'session',
      scene: { kind: 'desktop' },
      knowledge: [{ id: 'password', correct: false }],
    });
    expect(apply(continued, { type: 'answer-check', answerId: 'replace-now' }, 7)).toEqual({
      ...continued,
      now: 7,
    });
  });

  it('ignores inherited answer identifiers and records no duplicate knowledge answer', () => {
    const opened = apply(desktop(), { type: 'open', id: 'mail' }, 1);
    const started = apply(opened, { type: 'routine', id: 'password', action: 'complete' }, 2);
    expect(apply(started, { type: 'answer-check', answerId: 'constructor' }, 1)).toEqual({
      ...started,
      now: 2,
    });
    const answered = apply(started, { type: 'answer-check', answerId: 'replace-now' }, 3);
    expect(apply(answered, { type: 'answer-check', answerId: 'wait-cycle' }, 4)).toEqual({
      ...answered,
      now: 4,
    });
  });

  it('expires before applying an optional knowledge answer and discards it on reset', () => {
    const opened = apply(desktop(), { type: 'open', id: 'mail' }, 1);
    const state = apply(opened, { type: 'routine', id: 'password', action: 'complete' }, 2);
    expect(apply(state, { type: 'answer-check', answerId: 'replace-now' }, 60_000)).toEqual({
      phase: 'login',
      generation: 1,
      now: 60_000,
      reason: 'expired',
      failedAttempts: 0,
    });
    const answered = apply(state, { type: 'answer-check', answerId: 'replace-now' }, 3);
    expect(apply(answered, { type: 'logout' }, 4)).toEqual({
      phase: 'login',
      generation: 1,
      now: 4,
      reason: 'logout',
      failedAttempts: 0,
    });
  });

  it('opens the incident immediately after a risky USB result and records each result once', () => {
    const usb = apply(desktop(), { type: 'open', id: 'usb' }, 1);
    const feedback = apply(usb, { type: 'choose', choiceId: 'open' }, 2);
    const chained = apply(feedback, { type: 'continue' }, 3);
    expect(chained).toMatchObject({
      phase: 'session',
      usbInfected: true,
      results: [{ id: 'usb', outcome: 'risky', choiceId: 'open' }],
      scene: { kind: 'challenge', id: 'incident', step: 'explore' },
    });
    if (feedback.phase === 'session' && feedback.scene.kind === 'feedback') {
      expect(incidentFollowsFeedback(feedback, feedback.scene.result)).toBe(true);
    }
    expect(apply(chained, { type: 'choose', choiceId: 'bad-id' }, 4)).toEqual({
      ...chained,
      now: 4,
    });
    expect(apply(chained, { type: 'choose', choiceId: 'constructor' }, 4)).toEqual({
      ...chained,
      now: 4,
    });
    expect(apply(chained, { type: 'choose', choiceId: 'toString' }, 4)).toEqual({
      ...chained,
      now: 4,
    });
  });

  it('records ejection as a safe USB outcome without treating the device as harmless', () => {
    const usb = apply(desktop(), { type: 'open', id: 'usb' }, 1);
    const ejected = apply(usb, { type: 'choose', choiceId: 'eject' }, 2);
    expect(challengeChoiceIds('usb', 'choose')).toContain('eject');
    expect(choiceOutcome('usb', 'choose', 'eject')).toBe('safe');
    expect(ejected).toMatchObject({
      phase: 'session',
      usbInfected: false,
      results: [{ id: 'usb', outcome: 'safe', choiceId: 'eject' }],
      scene: { kind: 'feedback', result: { id: 'usb', outcome: 'safe', choiceId: 'eject' } },
    });
  });

  it('requires both incident steps before recording an outcome', () => {
    const exploring = apply(desktop(), { type: 'open', id: 'incident' }, 100);
    const incident = apply(exploring, { type: 'begin-decision' }, 100);
    const notify = apply(incident, { type: 'choose', choiceId: 'isolate' }, 101);
    expect(notify).toMatchObject({
      phase: 'session',
      results: [],
      scene: { kind: 'challenge', step: 'notify' },
    });
    if (notify.phase === 'session' && notify.scene.kind === 'challenge') {
      expect(actionDockStartsOpen(notify.scene)).toBe(true);
    }
    const safe = apply(notify, { type: 'choose', choiceId: 'notify' }, 102);
    expect(safe).toMatchObject({
      phase: 'session',
      results: [{ id: 'incident', outcome: 'safe', choiceId: 'notify' }],
    });
  });

  it('keeps choices available after a long reading pause', () => {
    const exploring = apply(desktop(), { type: 'open', id: 'web' }, 1);
    const opened = apply(exploring, { type: 'begin-decision' }, 1);
    const waiting = apply(opened, { type: 'tick' }, 30_001);
    expect(waiting).toMatchObject({ results: [], scene: { kind: 'challenge', step: 'choose' } });
    expect(apply(waiting, { type: 'choose', choiceId: 'known-address' }, 30_002)).toMatchObject({
      phase: 'session',
      scene: { kind: 'feedback', result: { id: 'web', outcome: 'safe' } },
    });
  });

  it('lets the player read the reporting step without losing the incident', () => {
    const incident = apply(desktop(), { type: 'open', id: 'incident' }, 100);
    const notify = apply(incident, { type: 'choose', choiceId: 'isolate' }, 101);
    const waiting = apply(notify, { type: 'tick' }, 30_100);
    expect(waiting).toMatchObject({
      phase: 'session',
      results: [],
      scene: { kind: 'challenge', id: 'incident', step: 'notify' },
    });
    expect(apply(waiting, { type: 'choose', choiceId: 'notify' }, 30_101)).toMatchObject({
      scene: { kind: 'feedback', result: { id: 'incident', outcome: 'safe' } },
    });
  });

  it('keeps a locked session inert while preserving the global deadline', () => {
    const exploring = apply(desktop(), { type: 'open', id: 'web' }, 1);
    const deciding = apply(exploring, { type: 'begin-decision' }, 2);
    const locked = apply(deciding, { type: 'practice-lock' }, 3);
    expect(locked).toMatchObject({
      phase: 'session',
      locked: true,
      routines: { lockPracticed: true },
    });
    const elapsed = apply(locked, { type: 'choose', choiceId: 'known-address' }, 10_002);
    expect(elapsed).toEqual({
      ...locked,
      now: 10_002,
    });
    const resumed = apply(elapsed, { type: 'resume-lock' }, 10_002);
    expect(resumed).toMatchObject({
      phase: 'session',
      locked: false,
      scene: { kind: 'challenge' },
    });
    expect(apply(resumed, { type: 'tick' }, 10_002)).toMatchObject({
      phase: 'session',
      results: [],
      scene: { kind: 'challenge', id: 'web', step: 'choose' },
    });
    expect(apply(locked, { type: 'tick' }, 60_000)).toEqual({
      phase: 'login',
      generation: 1,
      now: 60_000,
      reason: 'expired',
      failedAttempts: 0,
    });
  });

  it('tracks activity, idle dismissal, and independent routine outcomes', () => {
    const started = desktop();
    const idle = apply(started, { type: 'tick' }, 5_000);
    expect(idleReminderVisible(idle, config)).toBe(true);
    const active = apply(idle, { type: 'activity' }, 5_001);
    expect(active).toMatchObject({
      phase: 'session',
      routines: { lastActivityAt: 5_001, idleDismissed: false },
    });
    const dismissed = apply(active, { type: 'dismiss-idle' }, 10_001);
    expect(dismissed).toMatchObject({ phase: 'session', routines: { idleDismissed: true } });
    expect(idleReminderVisible(dismissed, config)).toBe(false);

    const passwordLater = apply(
      active,
      { type: 'routine', id: 'password', action: 'later' },
      5_002,
    );
    expect(passwordLater).toMatchObject({ phase: 'session', routines: { password: 'later' } });
    const passwordDone = apply(
      passwordLater,
      { type: 'routine', id: 'password', action: 'complete' },
      5_003,
    );
    expect(passwordDone).toMatchObject({ phase: 'session', routines: { password: 'done' } });
    const updateScheduled = apply(
      passwordDone,
      { type: 'routine', id: 'update', action: 'complete' },
      5_004,
    );
    expect(updateScheduled).toMatchObject({ phase: 'session', routines: { update: 'scheduled' } });
    expect(
      apply(updateScheduled, { type: 'routine', id: 'update', action: 'later' }, 5_005),
    ).toEqual({
      ...updateScheduled,
      now: 5_005,
    });
  });

  it('preserves incident notification while free exploration switches between challenges', () => {
    const exploring = apply(desktop(), { type: 'open', id: 'incident' }, 10);
    const deciding = apply(exploring, { type: 'begin-decision' }, 11);
    const notifying = apply(deciding, { type: 'choose', choiceId: 'isolate' }, 12);
    const elsewhere = apply(notifying, { type: 'open', id: 'mail' }, 13);
    expect(elsewhere).toMatchObject({
      phase: 'session',
      scene: { kind: 'challenge', id: 'mail', step: 'explore' },
      pendingIncident: { startedAt: 10 },
    });
    expect(incidentIsolated(elsewhere)).toBe(true);
    const reopened = apply(elsewhere, { type: 'open', id: 'incident' }, 30_000);
    expect(reopened).toMatchObject({
      phase: 'session',
      pendingIncident: null,
      scene: { kind: 'challenge', id: 'incident', step: 'notify' },
    });
  });

  it('preserves an outstanding report when guided play starts after a long pause', () => {
    const incident = apply(desktop(), { type: 'open', id: 'incident' }, 10);
    const notifying = apply(incident, { type: 'choose', choiceId: 'isolate' }, 12);
    const mail = apply(notifying, { type: 'open', id: 'mail' }, 13);
    const guided = apply(mail, { type: 'finish-experience' }, 30_011);
    expect(guided).toMatchObject({
      phase: 'session',
      mode: 'guided',
      deadline: 60_000,
      results: [],
      pendingIncident: { startedAt: 10 },
      scene: { kind: 'challenge', id: 'mail', step: 'choose' },
    });
  });

  it('keeps an outstanding report in the background until the global reset', () => {
    const incident = apply(desktop(), { type: 'open', id: 'incident' }, 10);
    const notifying = apply(incident, { type: 'choose', choiceId: 'isolate' }, 12);
    const mail = apply(notifying, { type: 'open', id: 'mail' }, 13);
    const waiting = apply(mail, { type: 'tick' }, 30_000);
    expect(waiting).toMatchObject({
      phase: 'session',
      scene: { kind: 'challenge', id: 'mail' },
      pendingIncident: { startedAt: 10 },
      results: [],
    });
    expect(apply(waiting, { type: 'tick' }, 60_000)).toEqual({
      phase: 'login',
      generation: 1,
      now: 60_000,
      reason: 'expired',
      failedAttempts: 0,
    });
  });

  it('guides missing challenges in stable order', () => {
    let state: GameState = apply(desktop(), { type: 'finish-experience' }, 1);
    const choose = (choiceId: string, now: number) => {
      state = apply(state, { type: 'choose', choiceId }, now);
    };
    const advance = (now: number) => {
      state = apply(state, { type: 'continue' }, now);
    };

    expect(state).toMatchObject({
      phase: 'session',
      mode: 'guided',
      scene: { kind: 'challenge', id: 'usb', step: 'choose' },
    });
    choose('station', 2);
    advance(3);
    expect(state).toMatchObject({ scene: { kind: 'challenge', id: 'incident', step: 'choose' } });
    choose('isolate', 4);
    expect(state).toMatchObject({ scene: { kind: 'challenge', step: 'notify' } });
    choose('notify', 5);
    advance(6);
    choose('verify', 7);
    advance(8);
    expect(state).toMatchObject({
      scene: { kind: 'challenge', id: 'spoof', step: 'explore' },
    });
    choose('understood', 9);
    advance(10);
    choose('known-address', 11);
    advance(12);
    choose('deny-report', 13);
    advance(14);
    expect(state).toMatchObject({
      scene: { kind: 'challenge', id: 'ai', step: 'explore' },
    });
    choose('internal-generic', 15);
    advance(16);
    expect(state).toMatchObject({ phase: 'session', scene: { kind: 'routines' } });
    state = apply(state, { type: 'continue' }, 17);
    expect(state).toMatchObject({ phase: 'session', mode: 'guided', scene: { kind: 'debrief' } });
    if (state.phase === 'session') expect(state.results).toHaveLength(7);
  });

  it('prioritizes the open free challenge and skips routines already completed', () => {
    const current = apply(desktop(), { type: 'open', id: 'web' }, 1);
    expect(apply(current, { type: 'finish-experience' }, 2)).toMatchObject({
      phase: 'session',
      mode: 'guided',
      scene: { kind: 'challenge', id: 'web', step: 'choose' },
    });

    const incident = apply(desktop(), { type: 'open', id: 'incident' }, 3);
    const notifying = apply(incident, { type: 'choose', choiceId: 'isolate' }, 4);
    expect(apply(notifying, { type: 'finish-experience' }, 5)).toMatchObject({
      phase: 'session',
      mode: 'guided',
      scene: { kind: 'challenge', id: 'incident', step: 'notify' },
    });

    const complete = {
      ...desktop(),
      results: [
        { id: 'usb', outcome: 'safe', choiceId: 'station' },
        { id: 'incident', outcome: 'safe', choiceId: 'notify' },
        { id: 'mail', outcome: 'safe', choiceId: 'verify' },
        { id: 'spoof', outcome: 'safe', choiceId: 'understood' },
        { id: 'web', outcome: 'safe', choiceId: 'known-address' },
        { id: 'mfa', outcome: 'safe', choiceId: 'deny-report' },
        { id: 'ai', outcome: 'safe', choiceId: 'internal-generic' },
      ] as const,
      routines: {
        password: 'done' as const,
        update: 'scheduled' as const,
        lockPracticed: true,
        lastActivityAt: 0,
        idleDismissed: false,
      },
    };
    expect(apply(complete, { type: 'finish-experience' }, 1)).toMatchObject({
      phase: 'session',
      mode: 'guided',
      scene: { kind: 'debrief' },
    });
  });

  it('uses ambient slots only during free exploration and hides idle reminders while guided', () => {
    const started = desktop();
    expect(ambientSlot(started, config)).toBe(0);
    const passwordEvent = apply(started, { type: 'tick' }, 10_000);
    expect(ambientSlot(passwordEvent, config)).toBe(1);
    expect(nextAmbientEvent(passwordEvent, config)).toBe('password');
    const passwordDone = apply(
      passwordEvent,
      { type: 'routine', id: 'password', action: 'complete' },
      10_001,
    );
    expect(nextAmbientEvent(passwordDone, config)).toBeNull();
    const updateEvent = apply(passwordDone, { type: 'tick' }, 20_000);
    expect(nextAmbientEvent(updateEvent, config)).toBe('update');
    const guided = apply(updateEvent, { type: 'finish-experience' }, 20_001);
    expect(nextAmbientEvent(guided, config)).toBeNull();
    expect(idleReminderVisible(apply(guided, { type: 'tick' }, 30_000), config)).toBe(false);
  });

  it.each([
    ['internal', 'full', 'risky'],
    ['internal', 'masked', 'risky'],
    ['internal', 'generic', 'safe'],
    ['commercial', 'full', 'risky'],
    ['commercial', 'masked', 'risky'],
    ['commercial', 'generic', 'safe'],
  ] as const)('evaluates AI submission %s/%s in the core', (tool, prompt, outcome) => {
    const opened = apply(desktop(), { type: 'open', id: 'ai' }, 1);
    expect(opened).toMatchObject({ scene: { kind: 'challenge', step: 'explore' } });
    const submitted = apply(opened, { type: 'send-ai', tool, prompt }, 2);
    expect(submitted).toMatchObject({
      scene: { kind: 'feedback', result: { id: 'ai', choiceId: `${tool}-${prompt}`, outcome } },
    });
    expect(
      apply(submitted, { type: 'send-ai', tool: 'internal', prompt: 'generic' }, 3),
    ).toMatchObject({ results: [{ id: 'ai', outcome }] });
  });

  it('rejects AI sends in other windows, while locked, with invalid choices, and after expiry', () => {
    const send = { type: 'send-ai', tool: 'internal', prompt: 'generic' } as const;
    const mail = apply(desktop(), { type: 'open', id: 'mail' }, 1);
    expect(apply(mail, send, 2)).toEqual({ ...mail, now: 2 });
    const opened = apply(desktop(), { type: 'open', id: 'ai' }, 1);
    expect(apply(opened, { ...send, prompt: 'unknown' as never }, 2)).toEqual({
      ...opened,
      now: 2,
    });
    expect(apply(apply(opened, { type: 'practice-lock' }, 2), send, 3)).toMatchObject({
      locked: true,
      results: [],
    });
    expect(apply(opened, send, 60_000)).toMatchObject({ phase: 'login', reason: 'expired' });
  });

  it('only accepts acknowledgement in the local spoof demonstration', () => {
    const spoof = apply(desktop(), { type: 'open', id: 'spoof' }, 1);
    expect(apply(spoof, { type: 'choose', choiceId: 'verify' }, 2)).toEqual({ ...spoof, now: 2 });
    expect(apply(spoof, { type: 'choose', choiceId: 'understood' }, 2)).toMatchObject({
      phase: 'session',
      scene: { kind: 'feedback', result: { id: 'spoof', outcome: 'safe', choiceId: 'understood' } },
    });
  });

  it('shares declared choice identifiers and accepts the safe mail report action', () => {
    expect(challengeChoiceIds('mail', 'choose')).toEqual(['reply', 'open', 'verify', 'report']);
    expect(choiceOutcome('mail', 'choose', 'report')).toBe('safe');
    expect(choiceOutcome('mail', 'choose', 'constructor')).toBeNull();

    const mail = apply(desktop(), { type: 'open', id: 'mail' }, 1);
    expect(apply(mail, { type: 'choose', choiceId: 'report' }, 2)).toMatchObject({
      phase: 'session',
      scene: { kind: 'feedback', result: { id: 'mail', outcome: 'safe', choiceId: 'report' } },
    });
  });

  it('ignores invalid runtime challenge identifiers and does not mutate frozen input', () => {
    const frozen = deepFreeze(desktop());
    const invalid = apply(frozen, { type: 'open', id: 'unknown' as never }, 2);
    expect(invalid).toEqual({ ...frozen, now: 2 });
    expect(frozen.now).toBe(0);
    expect(frozen.scene).toEqual({ kind: 'desktop' });
  });

  it('treats malformed runtime payload fields as inert or failed input', () => {
    const invalidPassword = transition(
      initialState(),
      { type: 'login', password: null as never },
      1,
      config,
    );
    expect(invalidPassword).toMatchObject({ phase: 'login', failedAttempts: 1 });

    const onDesktop = desktop();
    expect(
      apply(onDesktop, { type: 'routine', id: '__proto__' as never, action: 'complete' }, 1),
    ).toEqual({ ...onDesktop, now: 1 });
    const opened = apply(onDesktop, { type: 'open', id: 'usb' }, 1);
    expect(apply(opened, { type: 'choose', choiceId: {} as never }, 2)).toEqual({
      ...opened,
      now: 2,
    });
  });

  it.each([
    ['usb', 'station', 'safe', 'open', 'risky'],
    ['incident', 'restart', 'risky', 'notify', 'safe'],
    ['mail', 'report', 'safe', 'reply', 'risky'],
    ['spoof', 'understood', 'safe', 'understood', 'safe'],
    ['web', 'submit', 'risky', 'known-address', 'safe'],
    ['mfa', 'approve', 'risky', 'deny-report', 'safe'],
    ['ai', 'commercial-full', 'risky', 'commercial-generic', 'safe'],
  ] as const)(
    'replays %s without replacing its first result',
    (id, firstChoice, firstOutcome, choiceId, outcome) => {
      const original = {
        ...desktop(),
        results: [{ id, choiceId: firstChoice, outcome: firstOutcome }],
      };
      let replay = apply(original, { type: 'open', id }, 10);
      expect(replay).toMatchObject({ phase: 'session', scene: { kind: 'challenge', id } });
      if (id === 'incident') replay = apply(replay, { type: 'choose', choiceId: 'isolate' }, 11);
      replay = apply(replay, { type: 'choose', choiceId }, 12);
      expect(replay).toMatchObject({
        phase: 'session',
        deadline: original.deadline,
        scene: { kind: 'feedback', replay: true, result: { id, choiceId, outcome } },
      });
      if (replay.phase !== 'session' || replay.scene.kind !== 'feedback')
        throw new Error('Expected replay feedback');
      expect(replay.results).toBe(original.results);
      expect(replay.knowledge).toBe(original.knowledge);
      expect(replay.usbInfected).toBe(original.usbInfected);
      expect(safeCount(replay)).toBe(safeCount(original));
      expect(assessedCount(replay)).toBe(assessedCount(original));
      expect(incidentFollowsFeedback(replay, replay.scene.result)).toBe(false);
      expect(apply(replay, { type: 'continue' }, 13)).toMatchObject({ scene: { kind: 'desktop' } });
    },
  );

  it('does not carry a replayed incident into the outstanding guided work', () => {
    const original = {
      ...desktop(),
      results: [{ id: 'incident', choiceId: 'restart', outcome: 'risky' }],
    } as const;
    const replay = apply(original, { type: 'open', id: 'incident' }, 1);
    const isolated = apply(replay, { type: 'choose', choiceId: 'isolate' }, 2);
    const elsewhere = apply(isolated, { type: 'open', id: 'mail' }, 3);
    expect(elsewhere).toMatchObject({ pendingIncident: null, results: original.results });
    const guided = apply(isolated, { type: 'finish-experience' }, 4);
    expect(guided).toMatchObject({
      mode: 'guided',
      pendingIncident: null,
      results: original.results,
      scene: { kind: 'challenge', id: 'usb' },
    });
    expect(apply(isolated, { type: 'tick' }, original.deadline)).toMatchObject({
      phase: 'login',
      reason: 'expired',
    });
  });

  it('completes all seven challenges once and reaches the debrief without duplicate score', () => {
    let state: GameState = desktop();
    const complete = (
      id: 'usb' | 'incident' | 'mail' | 'spoof' | 'web' | 'mfa' | 'ai',
      choiceId: string,
      now: number,
    ) => {
      state = apply(state, { type: 'open', id }, now);
      state = apply(state, { type: 'choose', choiceId }, now + 1);
      if (id === 'incident') state = apply(state, { type: 'choose', choiceId: 'notify' }, now + 2);
      state = apply(state, { type: 'continue' }, now + 3);
    };
    complete('usb', 'station', 1);
    complete('incident', 'isolate', 10);
    complete('mail', 'verify', 20);
    complete('spoof', 'understood', 30);
    complete('web', 'known-address', 40);
    complete('mfa', 'deny-report', 50);
    complete('ai', 'internal-generic', 54);
    expect(state).toMatchObject({ phase: 'session', scene: { kind: 'debrief' } });
    if (state.phase === 'session') {
      expect(state.results).toHaveLength(7);
      expect(new Set(state.results.map((result) => result.id)).size).toBe(7);
      expect(hasResult(state, 'spoof')).toBe(true);
      expect(allComplete(state)).toBe(true);
      expect(assessedCount(state)).toBe(6);
      expect(safeCount(state)).toBe(6);
      expect(apply(state, { type: 'continue' }, 60)).toEqual({ ...state, now: 60 });
      const resumed = apply({ ...state, mode: 'guided' }, { type: 'close' }, 61);
      expect(resumed).toMatchObject({
        mode: 'free',
        scene: { kind: 'desktop' },
        deadline: state.deadline,
      });
      const replay = apply(resumed, { type: 'open', id: 'usb' }, 62);
      const feedback = apply(replay, { type: 'choose', choiceId: 'open' }, 63);
      const recap = apply(feedback, { type: 'continue' }, 64);
      expect(recap).toMatchObject({ scene: { kind: 'debrief' }, results: state.results });
      expect(safeCount(recap)).toBe(6);
    }
  });
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
