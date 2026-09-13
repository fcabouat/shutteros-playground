// The installer has no Node dependency. Compare its Python decoder with the app's
// TypeScript boundary here so the two V1 contracts cannot silently drift apart.
import { deepStrictEqual } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeConfiguration } from '../../../src/lib/contract/configuration.ts';

const baseline = JSON.parse(
  readFileSync(new URL('../../../static/kiosk-config.json', import.meta.url), 'utf8'),
);
const validator = fileURLToPath(new URL('../validate-config.py', import.meta.url));
const cases = [
  baseline,
  { ...baseline, partnerOrganizationName: 'Partner', partnerOrganizationLogo: 'logo-partner.svg' },
  { ...baseline, partnerOrganizationName: '' },
  { ...baseline, partnerOrganizationName: 'x'.repeat(81) },
  { ...baseline, partnerOrganizationLogo: 'logo.svg' },
  { ...baseline, partnerOrganizationName: 'Partner', partnerOrganizationLogo: '../logo.svg' },
  { ...baseline, partnerOrganizationName: null },
  null,
  [],
  { ...baseline, version: true },
  { ...baseline, sessionMinutes: true },
  { ...baseline, sessionMinutes: 0 },
  { ...baseline, sessionMinutes: 30.1 },
  { ...baseline, challengeSeconds: 10, explorationSeconds: 0 },
  { ...baseline, challengeSeconds: 10, defaultCalmMode: true },
  { ...baseline, challengeSeconds: 9 },
  { ...baseline, challengeSeconds: 121 },
  { ...baseline, challengeSeconds: null },
  { ...baseline, organizationName: ' \t ' },
  { ...baseline, organizationName: '\ufeff' },
  { ...baseline, organizationName: '\u0085' },
  { ...baseline, organizationName: '\ud800' },
  { ...baseline, organizationName: '🌍'.repeat(40) },
  { ...baseline, organizationName: '🌍'.repeat(41) },
  { ...baseline, acceptedPasswords: [] },
  { ...baseline, acceptedPasswords: ['🌍'.repeat(51)] },
  { ...baseline, organizationLogo: 'logo-organisation.svg' },
  { ...baseline, organizationLogo: '../logo.svg' },
  { ...baseline, organizationLogo: 'İ.svg' },
  { ...baseline, organizationLogo: 'Kiosk.svg' },
  { ...baseline, organizationLogo: 'logo.svg\n' },
  { ...baseline, mailLegitimateAddress: 'user@organisation.example\n' },
  { ...baseline, defaultCalmMode: 'false' },
  { ...baseline, defaultCalmMode: null },
  { ...baseline, sessionMinuts: 10 },
];
const scratch = mkdtempSync(join(tmpdir(), 'shutteros-config-parity-'));
const serialized = JSON.stringify(baseline);
const wireCases = [
  serialized.replace('"version":1', '"version":1.0'),
  serialized.replace('"version":1', '"version":1e0'),
  serialized.replace('"version":1', '"version":1.0000000000000001'),
  serialized.replace(`"sessionMinutes":${baseline.sessionMinutes}`, '"sessionMinutes":NaN'),
  '{invalid',
];
try {
  const file = join(scratch, 'kiosk-config.json');
  for (const [index, value] of cases.entries()) {
    writeFileSync(file, JSON.stringify(value));
    const result = spawnSync('python3', [validator, file], { encoding: 'utf8' });
    if (result.error) throw result.error;
    deepStrictEqual(
      result.status === 0,
      decodeConfiguration(value).ok,
      `V1 contract disagreement in case ${index}: ${result.stderr}`,
    );
  }
  // Lexical forms that JSON.stringify normalizes still belong to the wire contract.
  for (const raw of wireCases) {
    let accepted = false;
    try {
      accepted = decodeConfiguration(JSON.parse(raw)).ok;
    } catch {
      // Malformed JSON must be rejected before either field decoder runs.
    }
    writeFileSync(file, raw);
    const result = spawnSync('python3', [validator, file], { encoding: 'utf8' });
    if (result.error) throw result.error;
    deepStrictEqual(result.status === 0, accepted, result.stderr);
  }
  // The HTTP loader rejects >32 KiB before parsing; the installer must do so too.
  writeFileSync(file, JSON.stringify(baseline).padEnd(32_769, ' '));
  const result = spawnSync('python3', [validator, file], { encoding: 'utf8' });
  if (result.error) throw result.error;
  deepStrictEqual(result.status, 1);
  console.log(
    `${cases.length + wireCases.length + 1} installer/application configuration boundary cases passed.`,
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
