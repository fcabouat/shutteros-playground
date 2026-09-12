import type { KnowledgeAnswer } from './knowledge';

export type ChallengeId = 'usb' | 'incident' | 'mail' | 'spoof' | 'web' | 'mfa';

export type Outcome = 'safe' | 'risky' | 'timeout';

export type ChallengeResult = {
  id: ChallengeId;
  outcome: Outcome;
  choiceId: string;
};

export type Scene =
  | { kind: 'intro' }
  | { kind: 'desktop' }
  | {
      kind: 'challenge';
      id: ChallengeId;
      startedAt: number;
      exploreUntil: number;
      deadline: number | null;
      step: 'explore' | 'choose' | 'notify';
    }
  | { kind: 'feedback'; result: ChallengeResult }
  | { kind: 'routines' }
  | { kind: 'debrief' };

export type GameState =
  | {
      phase: 'login';
      generation: number;
      now: number;
      reason: 'initial' | 'logout' | 'expired';
      failedAttempts: number;
    }
  | {
      phase: 'session';
      generation: number;
      now: number;
      startedAt: number;
      deadline: number;
      calm: boolean;
      mode: 'free' | 'guided';
      scene: Scene;
      results: readonly ChallengeResult[];
      knowledge: readonly KnowledgeAnswer[];
      usbInfected: boolean;
      routines: {
        password: 'pending' | 'done' | 'later';
        update: 'pending' | 'scheduled' | 'later';
        lockPracticed: boolean;
        lastActivityAt: number;
        idleDismissed: boolean;
      };
      locked: boolean;
      pendingIncident: {
        startedAt: number;
        exploreUntil: number;
        deadline: number | null;
      } | null;
    };

export type Intent =
  | { type: 'login'; password: string }
  | { type: 'tick' }
  | { type: 'logout' }
  | { type: 'continue' }
  | { type: 'open'; id: ChallengeId }
  | { type: 'finish-experience' }
  | { type: 'begin-decision' }
  | { type: 'choose'; choiceId: string }
  | { type: 'close' }
  | { type: 'calm'; enabled: boolean }
  | { type: 'debrief' }
  | { type: 'answer-check'; answerId: string }
  | { type: 'activity' }
  | { type: 'routine'; id: 'password' | 'update'; action: 'complete' | 'later' }
  | { type: 'practice-lock' }
  | { type: 'resume-lock' }
  | { type: 'dismiss-idle' };
