import { describe, expect, it } from 'vitest';
import { challenges } from '../src/data/challenges';
import { englishChallenges } from '../src/data/challenges.en';
import { fr } from '../src/data/fr';
import { en } from '../src/data/en';
import type { GameState } from '../src/model/game';
import { currentKnowledgeId, knowledgeAnswer } from '../src/services/knowledge';

const session = (scene: Extract<GameState, { phase: 'session' }>['scene']): GameState => ({
  phase: 'session',
  generation: 0,
  now: 0,
  startedAt: 0,
  deadline: 60_000,
  loginCategory: 'displayed',
  mode: 'free',
  scene,
  results: [],
  knowledge: [],
  usbInfected: false,
  routines: {
    password: 'pending',
    update: 'pending',
    lockPracticed: false,
    lastActivityAt: 0,
    idleDismissed: false,
  },
  locked: false,
  activityVisible: true,
  pausedActivities: {},
});

describe('knowledge service', () => {
  it('exposes checks only at their intended stages', () => {
    expect(currentKnowledgeId(session({ kind: 'intro' }))).toBeNull();
    expect(
      currentKnowledgeId({
        ...session({
          kind: 'challenge',
          id: 'mail',
          startedAt: 0,
          step: 'choose',
          guidance: {
            requestedLevel: 0,
            started: true,
            activeElapsedMs: 0,
            activeSince: 0,
            visible: true,
          },
        }),
        routines: {
          ...session({ kind: 'desktop' }).routines,
          password: 'done',
        },
      }),
    ).toBeNull();
    expect(
      currentKnowledgeId({
        ...session({ kind: 'routines' }),
        routines: { ...session({ kind: 'desktop' }).routines, password: 'done' },
      }),
    ).toBe('password');
    expect(
      currentKnowledgeId(
        session({
          kind: 'feedback',
          replay: false,
          result: { id: 'incident', outcome: 'safe', choiceId: 'notify' },
        }),
      ),
    ).toBe('incident');
    expect(
      currentKnowledgeId(
        session({
          kind: 'feedback',
          replay: false,
          result: { id: 'mfa', outcome: 'safe', choiceId: 'deny-report' },
        }),
      ),
    ).toBe('mfa');
    expect(currentKnowledgeId(session({ kind: 'desktop' }))).toBeNull();
  });

  it('maps only own declared answer identifiers', () => {
    expect(knowledgeAnswer('password', 'replace-now')).toEqual({
      id: 'password',
      answerId: 'replace-now',
      correct: true,
    });
    expect(knowledgeAnswer('incident', 'wait-symptoms')).toMatchObject({ correct: false });
    expect(knowledgeAnswer('mfa', 'never-share')).toMatchObject({ correct: true });
    expect(knowledgeAnswer('mfa', 'toString')).toBeNull();
    expect(knowledgeAnswer('mfa', null as never)).toBeNull();
  });

  it('uses the same stable, varied answer order in both languages', () => {
    const expected = {
      password: ['wait-cycle', 'replace-now'],
      incident: ['report-now', 'wait-symptoms'],
      mfa: ['share-code', 'never-share'],
    } as const;
    for (const [id, order] of Object.entries(expected)) {
      const knowledgeId = id as keyof typeof expected;
      expect(fr.knowledge[knowledgeId].choices.map((choice) => choice.id)).toEqual(order);
      expect(en.knowledge[knowledgeId].choices.map((choice) => choice.id)).toEqual(order);
    }
    expect(fr.routines.passwordCheck).toContain('mot de passe professionnel');
    expect(en.routines.passwordCheck).toContain('work password');
    expect(fr.routines.check).not.toContain('mot de passe');
    expect(en.routines.check).not.toContain('password');
  });
});

it('keeps editorial highlights inside their translated lessons', () => {
  for (const catalog of [challenges, englishChallenges]) {
    for (const lesson of Object.values(catalog)) {
      expect(lesson.lessonEmphasis.length).toBeGreaterThan(0);
      expect(lesson.lesson).toContain(lesson.lessonEmphasis);
    }
  }
  for (const copy of [fr, en]) {
    expect(copy.intro.principle).toContain(copy.intro.principleEmphasis);
    for (const id of ['password', 'update'] as const) {
      expect(copy.routines[`${id}Lesson`]).toContain(copy.routines[`${id}Emphasis`]);
    }
  }
});
