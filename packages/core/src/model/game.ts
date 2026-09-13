import type { KnowledgeAnswer } from './knowledge';

export type ChallengeId = 'usb' | 'incident' | 'mail' | 'spoof' | 'web' | 'mfa' | 'ai';

export type AiTool = 'internal' | 'commercial';
export type AiPrompt = 'full' | 'masked' | 'generic';

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
const challengeChoices = {
  // The fictional policy approves only general templates in the internal tool.
  // Removing names leaves identifying details and confidential business data.
  ai: {
    choose: {
      'internal-full': 'risky',
      'internal-masked': 'risky',
      'internal-generic': 'safe',
      'commercial-full': 'risky',
      'commercial-masked': 'risky',
      'commercial-generic': 'risky',
    },
    notify: {},
  },
  usb: {
    choose: { open: 'risky', eject: 'safe', station: 'safe', report: 'safe' },
    notify: {},
  },
  incident: {
    choose: { isolate: 'safe', restart: 'risky', ignore: 'risky' },
    notify: { notify: 'safe', 'call-number': 'risky', delete: 'risky' },
  },
  mail: {
    choose: { reply: 'risky', open: 'risky', verify: 'safe', report: 'safe' },
    notify: {},
  },
  spoof: {
    choose: { understood: 'safe' },
    notify: {},
  },
  web: {
    choose: { submit: 'risky', 'known-address': 'safe', 'trust-lock': 'risky' },
    notify: {},
  },
  mfa: {
    choose: { approve: 'risky', 'deny-report': 'safe', ignore: 'risky' },
    notify: {},
  },
} as const satisfies Readonly<
  Record<ChallengeId, Readonly<Record<DecisionStep, Readonly<Record<string, Outcome>>>>>
>;

export type ChallengeChoiceId<
  Id extends ChallengeId,
  Step extends DecisionStep,
> = keyof (typeof challengeChoices)[Id][Step] & string;

export type ChallengeDecisionChoiceId<Id extends ChallengeId> = ChallengeChoiceId<Id, 'choose'>;

/** Return only declared choice outcomes; inherited object properties are never actions. */
export function choiceOutcome(
  id: ChallengeId,
  step: DecisionStep,
  choiceId: string,
): Outcome | null {
  const choices = challengeChoices[id][step] as Readonly<Record<string, Outcome>>;
  if (!Object.prototype.hasOwnProperty.call(choices, choiceId)) return null;
  return choices[choiceId] ?? null;
}

/** Stable domain identifiers for renderers that need to enumerate valid actions. */
export function challengeChoiceIds(id: ChallengeId, step: DecisionStep): readonly string[] {
  return Object.keys(challengeChoices[id][step]);
}

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
      step: 'explore' | DecisionStep;
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
      // Isolation is already done, but reporting is outstanding. This survives leaving
      // the incident window so its notification step can resume without repeating isolation.
      pendingIncident: {
        startedAt: number;
        exploreUntil: number;
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
  | { type: 'send-ai'; tool: AiTool; prompt: AiPrompt }
  | { type: 'close' }
  | { type: 'debrief' }
  | { type: 'answer-check'; answerId: string }
  | { type: 'activity' }
  | { type: 'routine'; id: 'password' | 'update'; action: 'complete' | 'later' }
  | { type: 'practice-lock' }
  | { type: 'resume-lock' }
  | { type: 'dismiss-idle' };
