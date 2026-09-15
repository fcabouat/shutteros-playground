import type { ChallengeId, DecisionStep, Outcome } from '../model/game';

type ActivityFamily = 'vigilance' | 'protection';

type ActivityAction = {
  outcome: Outcome;
  nextStep?: DecisionStep;
};

type ActivityStepDefinition = {
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
        actions: {
          open: { outcome: 'risky' },
          archive: { outcome: 'risky' },
          eject: { outcome: 'safe' },
          station: { outcome: 'safe' },
          report: { outcome: 'safe' },
        },
      },
      notify: { actions: {} },
    },
  },
  incident: {
    family: 'protection',
    initialStep: 'choose',
    steps: {
      choose: {
        actions: {
          isolate: { outcome: 'safe', nextStep: 'notify' },
          restart: { outcome: 'risky' },
          ignore: { outcome: 'risky' },
        },
      },
      notify: {
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
        actions: {
          reply: { outcome: 'risky' },
          open: { outcome: 'risky' },
          report: { outcome: 'safe' },
        },
      },
      notify: { actions: {} },
    },
  },
  spoof: {
    family: 'vigilance',
    initialStep: 'choose',
    steps: {
      choose: {
        actions: {
          comply: { outcome: 'risky' },
          reply: { outcome: 'risky' },
          report: { outcome: 'safe' },
        },
      },
      notify: { actions: {} },
    },
  },
  web: {
    family: 'vigilance',
    initialStep: 'choose',
    steps: {
      choose: {
        actions: {
          submit: { outcome: 'risky' },
          'known-address': { outcome: 'safe' },
          'trust-lock': { outcome: 'risky' },
        },
      },
      notify: { actions: {} },
    },
  },
  mfa: {
    family: 'vigilance',
    initialStep: 'choose',
    steps: {
      choose: {
        actions: {
          approve: { outcome: 'risky' },
          'deny-report': { outcome: 'safe' },
          ignore: { outcome: 'risky' },
        },
      },
      notify: { actions: {} },
    },
  },
  ai: {
    family: 'vigilance',
    initialStep: 'choose',
    steps: {
      choose: {
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
      notify: { actions: {} },
    },
  },
} as const satisfies Readonly<Record<ChallengeId, ActivityDefinition>>;

export function activityDefinition<Id extends ChallengeId>(
  id: Id,
): (typeof activityDefinitions)[Id] {
  return activityDefinitions[id];
}
