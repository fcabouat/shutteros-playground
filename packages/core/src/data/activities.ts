import type { ChallengeId, DecisionStep, Outcome } from '../model/game';

type ActivityFamily = 'vigilance' | 'protection';

type ActivityAction = {
  outcome: Outcome;
  nextStep?: DecisionStep;
};

type ActivityStepDefinition = {
  firstHintTarget: string | null;
  actions: Readonly<Record<string, ActivityAction>>;
};

type ActivityDefinition = {
  family: ActivityFamily;
  initialStep: DecisionStep;
  steps: Readonly<Record<DecisionStep, ActivityStepDefinition>>;
};

/**
 * The core owns action identity and consequences; catalogues only provide localized
 * labels and explanations. A nextStep keeps multi-stage activities declarative too.
 */
export const activityDefinitions = {
  usb: {
    family: 'vigilance',
    initialStep: 'choose',
    steps: {
      choose: {
        firstHintTarget: 'eject',
        actions: {
          open: { outcome: 'risky' },
          archive: { outcome: 'risky' },
          eject: { outcome: 'safe' },
          station: { outcome: 'safe' },
          report: { outcome: 'safe' },
        },
      },
      notify: { firstHintTarget: null, actions: {} },
    },
  },
  incident: {
    family: 'protection',
    initialStep: 'choose',
    steps: {
      choose: {
        firstHintTarget: 'network',
        actions: {
          isolate: { outcome: 'safe', nextStep: 'notify' },
          restart: { outcome: 'risky' },
          ignore: { outcome: 'risky' },
        },
      },
      notify: {
        firstHintTarget: 'report',
        actions: {
          notify: { outcome: 'safe' },
          'call-number': { outcome: 'risky' },
          delete: { outcome: 'risky' },
        },
      },
    },
  },
  mail: {
    family: 'vigilance',
    initialStep: 'choose',
    steps: {
      choose: {
        firstHintTarget: 'report',
        actions: {
          reply: { outcome: 'risky' },
          open: { outcome: 'risky' },
          report: { outcome: 'safe' },
        },
      },
      notify: { firstHintTarget: null, actions: {} },
    },
  },
  spoof: {
    family: 'vigilance',
    initialStep: 'choose',
    steps: {
      choose: {
        firstHintTarget: 'report',
        actions: {
          comply: { outcome: 'risky' },
          reply: { outcome: 'risky' },
          report: { outcome: 'safe' },
        },
      },
      notify: { firstHintTarget: null, actions: {} },
    },
  },
  web: {
    family: 'vigilance',
    initialStep: 'choose',
    steps: {
      choose: {
        firstHintTarget: 'bookmark',
        actions: {
          submit: { outcome: 'risky' },
          'known-address': { outcome: 'safe' },
          'trust-lock': { outcome: 'risky' },
        },
      },
      notify: { firstHintTarget: null, actions: {} },
    },
  },
  mfa: {
    family: 'vigilance',
    initialStep: 'choose',
    steps: {
      choose: {
        firstHintTarget: 'deny-report',
        actions: {
          approve: { outcome: 'risky' },
          'deny-report': { outcome: 'safe' },
          ignore: { outcome: 'risky' },
        },
      },
      notify: { firstHintTarget: null, actions: {} },
    },
  },
  ai: {
    family: 'vigilance',
    initialStep: 'choose',
    steps: {
      choose: {
        firstHintTarget: 'tool',
        actions: {
          'internal-routine': { outcome: 'safe' },
          'internal-routineAnonymised': { outcome: 'safe' },
          'internal-confidential': { outcome: 'risky' },
          'internal-confidentialAnonymised': { outcome: 'risky' },
          'internal-generic': { outcome: 'safe' },
          'commercial-routine': { outcome: 'risky' },
          'commercial-routineAnonymised': { outcome: 'safe' },
          'commercial-confidential': { outcome: 'risky' },
          'commercial-confidentialAnonymised': { outcome: 'risky' },
          'commercial-generic': { outcome: 'safe' },
        },
      },
      notify: { firstHintTarget: null, actions: {} },
    },
  },
} as const satisfies Readonly<Record<ChallengeId, ActivityDefinition>>;

export function activityDefinition<Id extends ChallengeId>(
  id: Id,
): (typeof activityDefinitions)[Id] {
  return activityDefinitions[id];
}
