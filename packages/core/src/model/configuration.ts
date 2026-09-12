export type GameConfig = {
  sessionDurationMs: number;
  challengeDurationMs: number;
  explorationDurationMs: number;
  idleReminderMs: number;
  eventIntervalMs: number;
  acceptedPasswords: readonly string[];
  caseSensitivePasswords: boolean;
  showPasswordHint: boolean;
  organizationName: string;
  organizationLogo?: string;
  playerName: string;
  supportLabel: string;
  supportContact: string;
  stationLabel: string;
  mailLegitimateAddress: string;
  mailImpersonatorAddress: string;
  defaultCalmMode: boolean;
};
