import { describe, expect, it } from 'vitest';
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
});
