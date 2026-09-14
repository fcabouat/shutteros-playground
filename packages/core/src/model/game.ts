import type { KnowledgeAnswer } from './knowledge';
import { activityDefinitions } from '../data/activities';

export type ChallengeId = 'usb' | 'incident' | 'mail' | 'spoof' | 'web' | 'mfa' | 'ai';

export type AiTool = 'internal' | 'commercial';
export type AiPrompt =
  'routine' | 'routineAnonymised' | 'confidential' | 'confidentialAnonymised' | 'generic';

export type Outcome = 'safe' | 'risky';

export type DecisionStep = 'choose' | 'notify';

/** Fixed journey order shared by the runtime and read-only UI projections. */
export const challengeOrder = [
  'usb',
  'incident',
  'mail',
  'spoof',
  'web',
  'mfa',
  'ai',
] as const satisfies readonly ChallengeId[];

/**
 * Authoritative domain actions. Labels and explanations remain in the content
 * catalogue, while the pure core owns which identifiers are valid and their effect.
 */
export type ChallengeChoiceId<
  Id extends ChallengeId,
  Step extends DecisionStep,
> = keyof (typeof activityDefinitions)[Id]['steps'][Step]['actions'] & string;

export type ChallengeDecisionChoiceId<Id extends ChallengeId> = ChallengeChoiceId<Id, 'choose'>;

/** Return only declared choice outcomes; inherited object properties are never actions. */
export function choiceOutcome(
  id: ChallengeId,
  step: DecisionStep,
  choiceId: string,
): Outcome | null {
  const choices = activityDefinitions[id].steps[step].actions as Readonly<
    Record<string, { outcome: Outcome }>
  >;
  if (!Object.prototype.hasOwnProperty.call(choices, choiceId)) return null;
  return choices[choiceId]?.outcome ?? null;
}

/** Stable domain identifiers for renderers that need to enumerate valid actions. */
export function challengeChoiceIds(id: ChallengeId, step: DecisionStep): readonly string[] {
  return Object.keys(activityDefinitions[id].steps[step].actions);
}

export type GuidanceLevel = 0 | 1 | 2;

/** Each unresolved help level advances after two minutes of active, visible time. */
export const guidanceDelayMs = 120_000;

export type GuidanceClock = {
  /** Highest level explicitly requested; elapsed active time may reveal more. */
  requestedLevel: GuidanceLevel;
  started: boolean;
  activeElapsedMs: number;
  activeSince: number | null;
  visible: boolean;
};

export type ChallengeResult = {
  id: ChallengeId;
  outcome: Outcome;
  choiceId: string;
  /** Choice that advanced a preceding stage, currently used for incident isolation. */
  priorChoiceId?: string;
};

/** Current learning step, independent of window placement or minimization. */
export type Scene =
  | { kind: 'intro' }
  | { kind: 'desktop' }
  | {
      kind: 'challenge';
      id: ChallengeId;
      startedAt: number;
      step: DecisionStep;
      priorChoiceId?: string;
      guidance: GuidanceClock;
    }
  // Replay feedback describes the latest attempt; results still owns the first one.
  | { kind: 'feedback'; result: ChallengeResult; replay: boolean }
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
      loginGuidance: GuidanceClock;
    }
  | {
      phase: 'session';
      generation: number;
      now: number;
      startedAt: number;
      deadline: number;
      // Category only: player input is never retained after a successful login.
      loginCategory: 'displayed' | 'weak';
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
      activityVisible: boolean;
      /** Unresolved attempts pause here while their activity is offscreen. */
      pausedActivities: Partial<Record<ChallengeId, Extract<Scene, { kind: 'challenge' }>>>;
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
  | { type: 'request-hint' }
  | { type: 'choose'; choiceId: string }
  | { type: 'send-ai'; tool: AiTool; prompt: AiPrompt }
  | { type: 'close' }
  | { type: 'debrief' }
  | { type: 'answer-check'; answerId: string }
  | { type: 'activity' }
  | { type: 'activity-visible'; visible: boolean }
  | { type: 'routine'; id: 'password' | 'update'; action: 'complete' | 'later' }
  | { type: 'practice-lock' }
  | { type: 'resume-lock' }
  | { type: 'dismiss-idle' };
