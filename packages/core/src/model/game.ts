import type { KnowledgeAnswer } from './knowledge';

export type ChallengeId = 'usb' | 'incident' | 'mail' | 'spoof' | 'web' | 'mfa';

export type Outcome = 'safe' | 'risky' | 'timeout';

export type ChallengeResult = {
  id: ChallengeId;
  outcome: Outcome;
  choiceId: string;
};

/** Current learning step, independent of window placement or minimization. */
export type Scene =
  | { kind: 'intro' }
  | { kind: 'desktop' }
  | {
      kind: 'challenge';
      id: ChallengeId;
      startedAt: number;
      exploreUntil: number;
      // Null means this attempt has no local timer; the session deadline still applies.
      deadline: number | null;
      step: 'explore' | 'choose' | 'notify';
    }
  | { kind: 'feedback'; result: ChallengeResult }
  | { kind: 'routines' }
  | { kind: 'debrief' };

/**
 * Session-owned data. Clock values are absolute milliseconds on the injected clock's
 * timeline; the core does not read a system clock or serialize this state.
 *
 * `generation` identifies a reset boundary. Game.svelte keys its component subtree
 * with it so local drafts and open dialogs are discarded along with domain state.
 */
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
      // First outcomes are retained by recordResult; optional knowledge answers are separate.
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
      // Isolation is already done, but reporting is outstanding. This survives leaving
      // the incident window so its notification step can resume with the same deadline.
      pendingIncident: {
        startedAt: number;
        exploreUntil: number;
        deadline: number | null;
      } | null;
    };

/**
 * Internal commands shared by live views and injected Storybook scenarios.
 * These describe player intent, not a trusted outcome; transition decides whether
 * a command is available. External configuration has a separate decoder.
 */
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
