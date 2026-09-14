import type { GameConfig } from '@shutteros/core/model/configuration';
import { initialState, transition } from '@shutteros/core/runtime/game';
import type { GameState, Intent, ChallengeId, Scene } from '@shutteros/core/model/game';

// Fixed clocks make these view scenarios stable and let their buttons remain playable.
export const config: GameConfig = {
  sessionDurationMs: 900_000,
  idleReminderMs: 45_000,
  eventIntervalMs: 90_000,
  acceptedPasswords: ['Bureau2026', 'password', 'motdepasse'],
  caseSensitivePasswords: false,
  showPasswordHint: true,
  playerName: 'Camille Martin',
  supportLabel: 'Équipes de sécurité informatique (SSI)',
  supportContact: 'Annuaire interne · contact SSI',
  stationLabel: 'Station blanche',
  mailLegitimateAddress: 'alex.martin@organisation.example',
  mailImpersonatorAddress: 'planning@services-personnel.danger.com',
};
export const login = initialState(0);
function play(intents: Intent[]): GameState {
  return intents.reduce((snapshot, intent) => transition(snapshot, intent, 0, config), login);
}
const enter: Intent[] = [{ type: 'login', password: 'password' }, { type: 'continue' }];
export const intro = play([enter[0]!]);
export const desktop = play(enter);
export const challenge = (id: ChallengeId) => play([...enter, { type: 'open', id }]);
export const infection = play([
  ...enter,
  { type: 'open', id: 'usb' },
  { type: 'choose', choiceId: 'open' },
]);
export const debrief = play([
  ...enter,
  { type: 'open', id: 'mail' },
  { type: 'choose', choiceId: 'report' },
  { type: 'continue' },
  { type: 'close' },
  { type: 'debrief' },
]);

// Fixed presentation fixtures cover rare states without waiting on the real clock.
export const locked = play([...enter, { type: 'practice-lock' }]);
export const lowTime: GameState =
  desktop.phase === 'session' ? { ...desktop, now: desktop.deadline - 20_000 } : desktop;
export const routines: GameState =
  desktop.phase === 'session'
    ? { ...desktop, mode: 'guided', scene: { kind: 'routines' } satisfies Scene }
    : desktop;
