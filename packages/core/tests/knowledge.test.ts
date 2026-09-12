import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/model/game';
import { currentKnowledgeId, knowledgeAnswer } from '../src/services/knowledge';

const session = (scene: Extract<GameState, { phase: 'session' }>['scene']): GameState => ({
  phase: 'session',
  generation: 0,
  now: 0,
  startedAt: 0,
  deadline: 60_000,
  calm: false,
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
  pendingIncident: null,
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
          exploreUntil: 25_000,
          deadline: null,
          step: 'explore',
        }),
        routines: {
          ...session({ kind: 'desktop' }).routines,
          password: 'done',
        },
      }),
    ).toBe('password');
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
          result: { id: 'incident', outcome: 'safe', choiceId: 'notify' },
        }),
      ),
    ).toBe('incident');
    expect(
      currentKnowledgeId(
        session({
          kind: 'feedback',
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
