import { describe, expect, it } from 'vitest';
import type { GameConfig } from '../src/model/configuration';
import { activityDefinition, activityDefinitions } from '../src/data/activities';
import { challenges, incidentNotify } from '../src/data/challenges';
import { englishChallenges, englishIncidentNotify } from '../src/data/challenges.en';
import {
  challengeChoiceIds,
  challengeOrder,
  choiceOutcome,
  guidanceDelayMs,
  type ChallengeId,
  type GameState,
  type Intent,
} from '../src/model/game';
import {
  activityIsVisible,
  allComplete,
  remainingActivities,
  experienceComplete,
  assessedCount,
  cautionCount,
  guidanceLevel,
  incidentIsolated,
  idleReminderVisible,
  loginHelpStarted,
  loginHintVisible,
  nextAmbientEvent,
  safeCount,
  resultAssessment,
} from '../src/projections/game';
import { initialState, transition } from '../src/runtime/game';

const config: GameConfig = {
  sessionDurationMs: 1_000_000,
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
  if (loggedIn.phase !== 'session') throw new Error('Expected session');
  return loggedIn;
}

function desktop(now = 0): Extract<GameState, { phase: 'session' }> {
  const ready = apply(session(now), { type: 'continue' }, now);
  if (ready.phase !== 'session' || ready.scene.kind !== 'desktop')
    throw new Error('Expected desktop');
  return ready;
}

describe('contextual guidance', () => {
  it('leaves login help dormant until interaction, then reveals it at the boundary', () => {
    const untouched = apply(initialState(), { type: 'tick' }, guidanceDelayMs * 4);
    expect(loginHelpStarted(untouched)).toBe(false);
    expect(loginHintVisible(untouched)).toBe(false);

    const active = apply(initialState(), { type: 'activity' }, 50);
    expect(loginHelpStarted(active)).toBe(true);
    expect(loginHintVisible(apply(active, { type: 'tick' }, 50 + guidanceDelayMs - 1))).toBe(false);
    expect(loginHintVisible(apply(active, { type: 'tick' }, 50 + guidanceDelayMs))).toBe(true);
  });

  it('reveals login help after three failures and resets on logout', () => {
    let state = initialState();
    for (let count = 1; count <= 3; count += 1) {
      state = apply(state, { type: 'login', password: 'wrong' }, count);
      expect(state).toMatchObject({ phase: 'login', failedAttempts: count });
    }
    expect(loginHintVisible(state)).toBe(true);
    const loggedOut = apply(
      apply(state, { type: 'login', password: 'accès' }, 4),
      { type: 'logout' },
      5,
    );
    expect(loggedOut).toMatchObject({ phase: 'login', failedAttempts: 0 });
    expect(loginHelpStarted(loggedOut)).toBe(false);
  });

  it('pauses the login timer while hidden', () => {
    let state = apply(initialState(), { type: 'activity' }, 0);
    state = apply(state, { type: 'activity-visible', visible: false }, 60_000);
    expect(activityIsVisible(state)).toBe(false);
    state = apply(state, { type: 'tick' }, 300_000);
    expect(loginHintVisible(state)).toBe(false);
    state = apply(state, { type: 'activity-visible', visible: true }, 300_000);
    expect(loginHintVisible(apply(state, { type: 'tick' }, 359_999))).toBe(false);
    expect(loginHintVisible(apply(state, { type: 'tick' }, 360_000))).toBe(true);
  });

  it('advances discovery, hint, and choices at exact active-time boundaries', () => {
    const opened = apply(desktop(), { type: 'open', id: 'usb' }, 10);
    expect(guidanceLevel(opened)).toBe(0);
    expect(guidanceLevel(apply(opened, { type: 'tick' }, 10 + guidanceDelayMs - 1))).toBe(0);
    const hinted = apply(opened, { type: 'tick' }, 10 + guidanceDelayMs);
    expect(guidanceLevel(hinted)).toBe(1);
    expect(guidanceLevel(apply(hinted, { type: 'tick' }, 10 + guidanceDelayMs * 2 - 1))).toBe(1);
    expect(guidanceLevel(apply(hinted, { type: 'tick' }, 10 + guidanceDelayMs * 2))).toBe(2);
  });

  it('reveals manual levels immediately and starts another delay after level one', () => {
    const opened = apply(desktop(), { type: 'open', id: 'mail' }, 0);
    const first = apply(opened, { type: 'request-hint' }, 10);
    expect(guidanceLevel(first)).toBe(1);
    expect(guidanceLevel(apply(first, { type: 'tick' }, 10 + guidanceDelayMs - 1))).toBe(1);
    expect(guidanceLevel(apply(first, { type: 'tick' }, 10 + guidanceDelayMs))).toBe(2);
    expect(guidanceLevel(apply(first, { type: 'request-hint' }, 11))).toBe(2);
  });

  it('can request the questionnaire explicitly without submitting an answer', () => {
    const opened = apply(desktop(), { type: 'open', id: 'usb' }, 0);
    const choices = apply(opened, { type: 'request-choices' }, 1);
    expect(guidanceLevel(choices)).toBe(2);
    if (opened.phase !== 'session' || choices.phase !== 'session') throw new Error();
    expect(choices.results).toEqual(opened.results);
    expect(apply(choices, { type: 'request-choices' }, 1)).toEqual(choices);
  });

  it('keeps stage identity while revealing both manual help levels', () => {
    const opened = apply(desktop(), { type: 'open', id: 'web' }, 20);
    if (opened.phase !== 'session' || opened.scene.kind !== 'challenge') throw new Error();
    const identity = {
      id: opened.scene.id,
      step: opened.scene.step,
      startedAt: opened.scene.startedAt,
    };
    const hinted = apply(opened, { type: 'request-hint' }, 21);
    expect(hinted).toMatchObject({ scene: identity });
    const choices = apply(hinted, { type: 'request-hint' }, 22);
    expect(choices).toMatchObject({ scene: identity });
    expect(guidanceLevel(choices)).toBe(2);
  });

  it('does not reset progress for repeated clicks or activity signals', () => {
    let state = apply(desktop(), { type: 'open', id: 'web' }, 0);
    state = apply(state, { type: 'activity' }, 80_000);
    state = apply(state, { type: 'open', id: 'web' }, 100_000);
    expect(guidanceLevel(apply(state, { type: 'tick' }, guidanceDelayMs))).toBe(1);
  });

  it('pauses on close and resumes the same help level without offscreen time', () => {
    let state = apply(desktop(), { type: 'open', id: 'mail' }, 0);
    state = apply(state, { type: 'request-hint' }, 10);
    state = apply(state, { type: 'close' }, 60_010);
    state = apply(state, { type: 'tick' }, 500_000);
    state = apply(state, { type: 'open', id: 'mail' }, 500_000);
    expect(guidanceLevel(state)).toBe(1);
    expect(guidanceLevel(apply(state, { type: 'tick' }, 559_999))).toBe(1);
    expect(guidanceLevel(apply(state, { type: 'tick' }, 560_000))).toBe(2);
  });

  it('preserves independent attempts while switching activities', () => {
    let state = apply(desktop(), { type: 'open', id: 'usb' }, 0);
    state = apply(state, { type: 'request-hint' }, 1);
    state = apply(state, { type: 'open', id: 'mail' }, 2);
    expect(guidanceLevel(state)).toBe(0);
    state = apply(state, { type: 'request-hint' }, 3);
    state = apply(state, { type: 'request-hint' }, 4);
    state = apply(state, { type: 'open', id: 'usb' }, 5);
    expect(guidanceLevel(state)).toBe(1);
    state = apply(state, { type: 'open', id: 'mail' }, 6);
    expect(guidanceLevel(state)).toBe(2);
  });

  it('pauses a minimized activity until it becomes visible', () => {
    let state = apply(desktop(), { type: 'open', id: 'spoof' }, 0);
    state = apply(state, { type: 'activity-visible', visible: false }, 60_000);
    state = apply(state, { type: 'tick' }, 500_000);
    expect(guidanceLevel(state)).toBe(0);
    state = apply(state, { type: 'activity-visible', visible: true }, 500_000);
    expect(guidanceLevel(apply(state, { type: 'tick' }, 559_999))).toBe(0);
    expect(guidanceLevel(apply(state, { type: 'tick' }, 560_000))).toBe(1);
  });

  it('pauses activity guidance while the session is locked', () => {
    let state = apply(desktop(), { type: 'open', id: 'web' }, 0);
    state = apply(state, { type: 'practice-lock' }, 60_000);
    state = apply(state, { type: 'tick' }, 500_000);
    expect(guidanceLevel(state)).toBe(0);
    state = apply(state, { type: 'resume-lock' }, 500_000);
    expect(guidanceLevel(apply(state, { type: 'tick' }, 559_999))).toBe(0);
    expect(guidanceLevel(apply(state, { type: 'tick' }, 560_000))).toBe(1);
  });

  it('returns to free exploration without resetting an in-progress incident', () => {
    let state = apply(desktop(), { type: 'open', id: 'incident' }, 1);
    state = apply(state, { type: 'choose', choiceId: 'isolate' }, 2);
    const guided = apply(state, { type: 'finish-experience' }, 3);
    const free = apply(guided, { type: 'explore-freely' }, 4);
    expect(free).toEqual({ ...guided, mode: 'free', now: 4 });
    expect(free).toMatchObject({ scene: { id: 'incident', step: 'notify' } });
    const other = apply(free, { type: 'open', id: 'usb' }, 5);
    expect(other).toMatchObject({ mode: 'free', scene: { id: 'usb' } });
    const resumed = apply(other, { type: 'open', id: 'incident' }, 6);
    expect(resumed).toMatchObject({ scene: { id: 'incident', step: 'notify' } });
  });

  it('opens every guided stage with choices available', () => {
    let state = apply(desktop(), { type: 'finish-experience' }, 1);
    expect(state).toMatchObject({ mode: 'guided', scene: { id: 'usb', step: 'choose' } });
    expect(guidanceLevel(state)).toBe(2);
    state = apply(
      apply(state, { type: 'choose', choiceId: 'station' }, 2),
      { type: 'continue' },
      3,
    );
    expect(state).toMatchObject({ scene: { id: 'incident', step: 'choose' } });
    expect(guidanceLevel(state)).toBe(2);
    state = apply(state, { type: 'choose', choiceId: 'isolate' }, 4);
    expect(state).toMatchObject({ scene: { id: 'incident', step: 'notify' } });
    expect(guidanceLevel(state)).toBe(2);
  });
});

describe('activity definitions and outcomes', () => {
  it('keeps definitions, families, and localized choice catalogues aligned', () => {
    expect(Object.keys(activityDefinitions)).toEqual(challengeOrder);
    expect(activityDefinition('usb').family).toBe('vigilance');
    expect(activityDefinition('incident').family).toBe('protection');
    expect(activityDefinition('ai').family).toBe('vigilance');
    for (const id of challengeOrder.filter((candidate) => candidate !== 'ai')) {
      const declared = challengeChoiceIds(id, 'choose');
      expect(challenges[id].choices.map((choice) => choice.id).sort()).toEqual(
        [...declared].sort(),
      );
      expect(englishChallenges[id].choices.map((choice) => choice.id).sort()).toEqual(
        [...declared].sort(),
      );
    }
    expect(incidentNotify.choices.map((choice) => choice.id).sort()).toEqual(
      [...challengeChoiceIds('incident', 'notify')].sort(),
    );
    expect(englishIncidentNotify.choices.map((choice) => choice.id).sort()).toEqual(
      [...challengeChoiceIds('incident', 'notify')].sort(),
    );
  });

  it('uses the requested USB, mail, and spoof outcomes', () => {
    expect(challengeChoiceIds('usb', 'choose')).toEqual([
      'open',
      'archive',
      'eject',
      'station',
      'report',
    ]);
    expect(choiceOutcome('usb', 'choose', 'archive')).toBe('risky');
    expect(choiceOutcome('usb', 'choose', 'eject')).toBe('safe');
    expect(choiceOutcome('mail', 'choose', 'verify')).toBeNull();
    expect(choiceOutcome('mail', 'choose', 'reply')).toBe('risky');
    expect(choiceOutcome('mail', 'choose', 'report')).toBe('safe');
    expect(challengeChoiceIds('spoof', 'choose')).toEqual(['comply', 'reply', 'report']);
    expect(choiceOutcome('spoof', 'choose', 'comply')).toBe('risky');
    expect(choiceOutcome('spoof', 'choose', 'report')).toBe('safe');
    expect(choiceOutcome('mail', 'choose', 'constructor')).toBeNull();
  });

  it('carries isolation through the incident reporting result', () => {
    let state = apply(desktop(), { type: 'open', id: 'incident' }, 10);
    state = apply(state, { type: 'choose', choiceId: 'isolate' }, 11);
    expect(state).toMatchObject({
      results: [],
      scene: { step: 'notify', priorChoiceId: 'isolate' },
    });
    expect(incidentIsolated(state)).toBe(true);
    expect(guidanceLevel(state)).toBe(0);
    state = apply(state, { type: 'open', id: 'mail' }, 12);
    expect(incidentIsolated(state)).toBe(true);
    state = apply(state, { type: 'open', id: 'incident' }, 13);
    expect(state).toMatchObject({ scene: { step: 'notify', priorChoiceId: 'isolate' } });
    state = apply(state, { type: 'choose', choiceId: 'notify' }, 14);
    expect(state).toMatchObject({
      scene: {
        kind: 'feedback',
        result: { choiceId: 'notify', priorChoiceId: 'isolate', outcome: 'safe' },
      },
    });
  });

  it('starts a fresh replay attempt while retaining the first report', () => {
    let state = apply(desktop(), { type: 'open', id: 'spoof' }, 1);
    state = apply(state, { type: 'request-hint' }, 2);
    state = apply(state, { type: 'choose', choiceId: 'report' }, 3);
    const firstResults = state.phase === 'session' ? state.results : [];
    state = apply(apply(state, { type: 'continue' }, 4), { type: 'open', id: 'spoof' }, 5);
    expect(guidanceLevel(state)).toBe(0);
    state = apply(state, { type: 'choose', choiceId: 'comply' }, 6);
    expect(state).toMatchObject({
      results: firstResults,
      scene: { kind: 'feedback', replay: true, result: { outcome: 'risky' } },
    });
  });

  it('counts spoof in assessed and safe totals', () => {
    const state = {
      ...desktop(),
      results: [{ id: 'spoof', outcome: 'safe', choiceId: 'report' }],
    } as const;
    expect(assessedCount(state)).toBe(1);
    expect(safeCount(state)).toBe(1);
  });

  it.each(['eject', 'station', 'report'] as const)(
    'assesses %s after the USB README as caution without infection',
    (choiceId) => {
      let state = apply(desktop(), { type: 'open', id: 'usb' }, 1);
      state = apply(state, { type: 'open-usb-readme' }, 2);
      expect(state).toMatchObject({
        results: [],
        usbInfected: false,
        scene: { kind: 'challenge', id: 'usb', openedReadme: true },
      });

      state = apply(state, { type: 'close' }, 3);
      state = apply(state, { type: 'open', id: 'usb' }, 4);
      expect(state).toMatchObject({ scene: { kind: 'challenge', openedReadme: true } });

      state = apply(state, { type: 'choose', choiceId }, 5);
      if (state.phase !== 'session' || state.scene.kind !== 'feedback') throw new Error();
      expect(state.scene.result).toMatchObject({ outcome: 'safe', openedReadme: true });
      expect(resultAssessment(state.scene.result)).toBe('caution');
      expect(state.usbInfected).toBe(false);
      expect(safeCount(state)).toBe(0);
      expect(cautionCount(state)).toBe(1);
    },
  );

  it('keeps the first USB caution result immutable when a replay is safe', () => {
    let state = apply(desktop(), { type: 'open', id: 'usb' }, 1);
    state = apply(state, { type: 'open-usb-readme' }, 2);
    state = apply(state, { type: 'choose', choiceId: 'eject' }, 3);
    const first = state.phase === 'session' ? state.results : [];
    state = apply(apply(state, { type: 'continue' }, 4), { type: 'open', id: 'usb' }, 5);
    state = apply(state, { type: 'choose', choiceId: 'eject' }, 6);
    expect(state).toMatchObject({
      results: first,
      scene: { kind: 'feedback', replay: true, result: { outcome: 'safe' } },
    });
    expect(cautionCount(state)).toBe(1);
    expect(safeCount(state)).toBe(0);
  });

  it.each(['open', 'archive'] as const)(
    'keeps %s red after the USB README is opened',
    (choiceId) => {
      let state = apply(desktop(), { type: 'open', id: 'usb' }, 1);
      state = apply(state, { type: 'open-usb-readme' }, 2);
      state = apply(state, { type: 'choose', choiceId }, 3);
      if (state.phase !== 'session' || state.scene.kind !== 'feedback') throw new Error();
      expect(resultAssessment(state.scene.result)).toBe('risky');
      expect(state.usbInfected).toBe(true);
    },
  );

  it.each([
    ['internal', 'routine', 'safe'],
    ['internal', 'confidential', 'risky'],
    ['commercial', 'routineAnonymised', 'safe'],
    ['commercial', 'routine', 'risky'],
  ] as const)('evaluates AI submission %s/%s', (tool, prompt, outcome) => {
    const opened = apply(desktop(), { type: 'open', id: 'ai' }, 1);
    expect(apply(opened, { type: 'send-ai', tool, prompt }, 2)).toMatchObject({
      scene: { kind: 'feedback', result: { choiceId: `${tool}-${prompt}`, outcome } },
    });
  });
});

describe('session-wide behavior', () => {
  it('keeps the global deadline and expires before applying its boundary action', () => {
    const opened = apply(desktop(5), { type: 'open', id: 'usb' }, 500);
    expect(opened).toMatchObject({ deadline: 1_000_005 });
    expect(apply(opened, { type: 'choose', choiceId: 'eject' }, 1_000_005)).toMatchObject({
      phase: 'login',
      reason: 'expired',
    });
  });

  it('shows ambient and idle reminders only on the unlocked free desktop', () => {
    const ready = desktop();
    const reminderTime = apply(ready, { type: 'tick' }, 10_000);
    expect(nextAmbientEvent(reminderTime, config)).toBe('password');
    expect(idleReminderVisible(reminderTime, config)).toBe(true);
    const challenge = apply(reminderTime, { type: 'open', id: 'mail' }, 10_001);
    expect(nextAmbientEvent(challenge, config)).toBeNull();
    expect(idleReminderVisible(challenge, config)).toBe(false);
    const feedback = apply(challenge, { type: 'choose', choiceId: 'report' }, 10_002);
    expect(nextAmbientEvent(feedback, config)).toBeNull();
    expect(idleReminderVisible(feedback, config)).toBe(false);
    const guided = apply(ready, { type: 'finish-experience' }, 10_003);
    expect(nextAmbientEvent(guided, config)).toBeNull();
    const locked = apply(ready, { type: 'practice-lock' }, 10_004);
    expect(nextAmbientEvent(locked, config)).toBeNull();
    const routines = { ...ready, mode: 'guided' as const, scene: { kind: 'routines' as const } };
    expect(nextAmbientEvent(routines, config)).toBeNull();
    expect(idleReminderVisible(routines, config)).toBe(false);
  });

  it('suppresses reminders for manually completed routines', () => {
    let state = apply(desktop(), { type: 'tick' }, 10_000);
    state = apply(state, { type: 'routine', id: 'password', action: 'complete' }, 10_001);
    expect(nextAmbientEvent(state, config)).toBeNull();
    state = apply(state, { type: 'tick' }, 20_000);
    state = apply(state, { type: 'routine', id: 'update', action: 'complete' }, 20_001);
    expect(nextAmbientEvent(state, config)).toBeNull();
    state = apply(state, { type: 'practice-lock' }, 20_002);
    state = apply(state, { type: 'resume-lock' }, 20_003);
    expect(idleReminderVisible(apply(state, { type: 'tick' }, 30_000), config)).toBe(false);
  });

  it('completes and scores every activity once', () => {
    const safeChoices: Record<ChallengeId, string> = {
      usb: 'eject',
      incident: 'isolate',
      mail: 'report',
      spoof: 'report',
      web: 'known-address',
      mfa: 'deny-report',
      ai: 'internal-generic',
    };
    let state: GameState = desktop();
    let now = 1;
    for (const id of challengeOrder) {
      state = apply(state, { type: 'open', id }, now++);
      state = apply(state, { type: 'choose', choiceId: safeChoices[id] }, now++);
      if (id === 'incident') state = apply(state, { type: 'choose', choiceId: 'notify' }, now++);
      state = apply(state, { type: 'continue' }, now++);
    }
    expect(allComplete(state)).toBe(true);
    expect(assessedCount(state)).toBe(7);
    expect(safeCount(state)).toBe(7);
    expect(state).toMatchObject({ scene: { kind: 'routines' } });
    expect(remainingActivities(state)).toBe(1);
    expect(experienceComplete(state)).toBe(false);
    state = apply(state, { type: 'continue' }, now++);
    expect(state).toMatchObject({ scene: { kind: 'routines' } });
    for (const id of ['password', 'update'] as const) {
      state = apply(state, { type: 'routine', id, action: 'complete' }, now++);
      expect(remainingActivities(state)).toBe(1);
    }
    state = apply(state, { type: 'practice-lock' }, now++);
    state = apply(state, { type: 'resume-lock' }, now++);
    expect(remainingActivities(state)).toBe(0);
    expect(experienceComplete(state)).toBe(true);
    state = apply(state, { type: 'continue' }, now++);
    expect(state).toMatchObject({ scene: { kind: 'debrief' } });
  });
});

describe('inbox continuation', () => {
  it.each(['mail', 'spoof'] as const)('opens the other unfinished message after %s', (first) => {
    const second = first === 'mail' ? 'spoof' : 'mail';
    let state: GameState = apply(desktop(), { type: 'open', id: first }, 1);
    state = apply(state, { type: 'choose', choiceId: 'report' }, 2);
    state = apply(state, { type: 'continue' }, 3);
    expect(state).toMatchObject({ scene: { kind: 'challenge', id: second } });
    state = apply(state, { type: 'choose', choiceId: 'report' }, 4);
    state = apply(state, { type: 'continue' }, 5);
    expect(state).toMatchObject({ scene: { kind: 'desktop' } });
    if (state.phase !== 'session') throw new Error('Expected session');
    const results = state.results;
    state = apply(state, { type: 'open', id: first }, 6);
    state = apply(state, { type: 'choose', choiceId: 'report' }, 7);
    state = apply(state, { type: 'continue' }, 8);
    expect(state).toMatchObject({ scene: { kind: 'desktop' }, results });
  });
});
