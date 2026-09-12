/** Editable V1 wire format; runtime units/defaults belong to the infrastructure mapper. */
type KioskConfigV1 = {
  version: 1;
  sessionMinutes: number;
  challengeSeconds: number;
  explorationSeconds?: number;
  idleReminderSeconds?: number;
  eventIntervalSeconds?: number;
  acceptedPasswords: string[];
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

type ConfigurationIssue = { path: string; message: string };
export type DecodeConfigurationResult =
  { ok: true; value: KioskConfigV1 } | { ok: false; issues: readonly ConfigurationIssue[] };

const keys = [
  'version',
  'sessionMinutes',
  'challengeSeconds',
  'explorationSeconds',
  'idleReminderSeconds',
  'eventIntervalSeconds',
  'acceptedPasswords',
  'caseSensitivePasswords',
  'showPasswordHint',
  'organizationName',
  'organizationLogo',
  'playerName',
  'supportLabel',
  'supportContact',
  'stationLabel',
  'mailLegitimateAddress',
  'mailImpersonatorAddress',
  'defaultCalmMode',
] as const;

const optionalKeys = [
  'explorationSeconds',
  'idleReminderSeconds',
  'eventIntervalSeconds',
  'organizationLogo',
] as const;

/**
 * Accumulate field diagnostics so an operator can fix the file in one pass.
 * Unknown keys are rejected to make misspelled settings visible. Optional absence
 * is valid here; configure supplies defaults without repairing invalid values.
 * This checks an already-parsed value; the loader bounds bytes before JSON.parse.
 */
export function decodeConfiguration(value: unknown): DecodeConfigurationResult {
  if (!isPlainRecord(value)) {
    return { ok: false, issues: [{ path: '', message: 'must be an object' }] };
  }

  const issues: ConfigurationIssue[] = [];
  for (const key of Object.keys(value)) {
    if (!(keys as readonly string[]).includes(key))
      issues.push({ path: key, message: 'unknown key' });
  }
  for (const key of keys) {
    if (
      !(optionalKeys as readonly string[]).includes(key) &&
      !Object.prototype.hasOwnProperty.call(value, key)
    ) {
      issues.push({ path: key, message: 'is required' });
    }
  }

  if (value.version !== 1) issues.push({ path: 'version', message: 'must equal 1' });
  validateNumber(value.sessionMinutes, 'sessionMinutes', 1, 30, issues);
  validateNumber(value.challengeSeconds, 'challengeSeconds', 10, 120, issues);
  validateOptionalNumber(value.explorationSeconds, 'explorationSeconds', 0, 60, issues);
  validateOptionalNumber(value.idleReminderSeconds, 'idleReminderSeconds', 10, 300, issues);
  validateOptionalNumber(value.eventIntervalSeconds, 'eventIntervalSeconds', 30, 300, issues);
  validatePasswords(value.acceptedPasswords, issues);
  validateText(value.organizationName, 'organizationName', 80, issues);
  validateOptionalLogo(value.organizationLogo, issues);
  validateText(value.playerName, 'playerName', 80, issues);
  validateText(value.supportLabel, 'supportLabel', 80, issues);
  validateText(value.supportContact, 'supportContact', 120, issues);
  validateText(value.stationLabel, 'stationLabel', 80, issues);
  validateEmail(value.mailLegitimateAddress, 'mailLegitimateAddress', issues);
  validateEmail(value.mailImpersonatorAddress, 'mailImpersonatorAddress', issues);
  validateBoolean(value.caseSensitivePasswords, 'caseSensitivePasswords', issues);
  validateBoolean(value.showPasswordHint, 'showPasswordHint', issues);
  validateBoolean(value.defaultCalmMode, 'defaultCalmMode', issues);

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: value as unknown as KioskConfigV1 };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function validateNumber(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
  issues: ConfigurationIssue[],
): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    issues.push({ path, message: `must be a number from ${minimum} to ${maximum}` });
  }
}

function validateOptionalNumber(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
  issues: ConfigurationIssue[],
): void {
  if (value !== undefined) validateNumber(value, path, minimum, maximum, issues);
}

function validatePasswords(value: unknown, issues: ConfigurationIssue[]): void {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) {
    issues.push({ path: 'acceptedPasswords', message: 'must contain 1 to 30 passwords' });
    return;
  }
  value.forEach((password, index) => validatePassword(password, index, issues));
}

function validatePassword(value: unknown, index: number, issues: ConfigurationIssue[]): void {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > 100) {
    issues.push({
      path: `acceptedPasswords[${index}]`,
      message: 'must be a non-blank string from 1 to 100 characters',
    });
  }
}

function validateText(
  value: unknown,
  path: string,
  maximum: number,
  issues: ConfigurationIssue[],
): void {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > maximum) {
    issues.push({ path, message: `must be a non-blank string from 1 to ${maximum} characters` });
  }
}

function validateBoolean(value: unknown, path: string, issues: ConfigurationIssue[]): void {
  if (typeof value !== 'boolean') issues.push({ path, message: 'must be a boolean' });
}

function validateOptionalLogo(value: unknown, issues: ConfigurationIssue[]): void {
  // A basename keeps the image at the deployment's own base path. URLs, fragments
  // and directory traversal are outside this contract; image contents are not decoded here.
  if (value === undefined) return;
  if (
    typeof value !== 'string' ||
    value.length > 120 ||
    value.trim() !== value ||
    !/^[a-z0-9][a-z0-9._-]*\.(png|webp|svg)$/i.test(value)
  ) {
    issues.push({
      path: 'organizationLogo',
      message: 'must be a local PNG, WebP, or SVG filename using letters, numbers, dot, _ or -',
    });
  }
}

function validateEmail(value: unknown, path: string, issues: ConfigurationIssue[]): void {
  // These are display addresses in a local simulation, not deliverability checks.
  // A bounded, readable shape is sufficient; no DNS or mail service is consulted.
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > 120 ||
    value.trim() !== value ||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)
  ) {
    issues.push({ path, message: 'must be a simple email address from 3 to 120 characters' });
  }
}
