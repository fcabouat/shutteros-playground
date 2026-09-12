import { describe, expect, it } from 'vitest';
import { decodeConfiguration } from '../../../src/lib/contract/configuration';

const valid = {
  version: 1,
  sessionMinutes: 5.5,
  challengeSeconds: 30,
  acceptedPasswords: ['invite'],
  caseSensitivePasswords: false,
  showPasswordHint: true,
  organizationName: 'Organisation',
  playerName: 'Camille',
  supportLabel: 'Support informatique',
  supportContact: 'support@example.test',
  stationLabel: 'Accueil',
  mailLegitimateAddress: 'equipe@organisation.example',
  mailImpersonatorAddress: 'usurpateur@externe.example',
  defaultCalmMode: false,
};

describe('decodeConfiguration', () => {
  it('accepts the strict V1 shape including decimal session durations', () => {
    expect(decodeConfiguration(valid)).toEqual({ ok: true, value: valid });
  });

  it('reports malformed structures, unknown fields and strict booleans', () => {
    expect(decodeConfiguration(null)).toMatchObject({
      ok: false,
      issues: [{ path: '', message: 'must be an object' }],
    });
    const result = decodeConfiguration({
      ...valid,
      sessionMinutes: 0,
      challengeSeconds: 121,
      explorationSeconds: 61,
      idleReminderSeconds: 9,
      eventIntervalSeconds: 301,
      acceptedPasswords: ['ok', 3],
      caseSensitivePasswords: 'false',
      mailLegitimateAddress: 'not an email',
      extra: true,
    });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          'extra',
          'sessionMinutes',
          'challengeSeconds',
          'explorationSeconds',
          'idleReminderSeconds',
          'eventIntervalSeconds',
          'acceptedPasswords[1]',
          'caseSensitivePasswords',
          'mailLegitimateAddress',
        ]),
      );
    }
  });

  it('accepts bounded optional timing values', () => {
    expect(
      decodeConfiguration({
        ...valid,
        explorationSeconds: 0,
        idleReminderSeconds: 300,
        eventIntervalSeconds: 30,
      }),
    ).toEqual({
      ok: true,
      value: {
        ...valid,
        explorationSeconds: 0,
        idleReminderSeconds: 300,
        eventIntervalSeconds: 30,
      },
    });
  });

  it('accepts only a local organisation logo basename', () => {
    expect(decodeConfiguration({ ...valid, organizationLogo: 'logo-organisation.svg' })).toEqual({
      ok: true,
      value: { ...valid, organizationLogo: 'logo-organisation.svg' },
    });

    for (const organizationLogo of [
      '../logo.svg',
      'images/logo.svg',
      'https://example.test/logo.svg',
      'logo.svg?variant=1',
      'data:image/svg+xml,logo',
      'logo.txt',
    ]) {
      const decoded = decodeConfiguration({ ...valid, organizationLogo });
      expect(decoded).toMatchObject({ ok: false });
      if (!decoded.ok) {
        expect(decoded.issues).toContainEqual(
          expect.objectContaining({ path: 'organizationLogo' }),
        );
      }
    }
  });

  it('enforces password and text size limits', () => {
    const result = decodeConfiguration({
      ...valid,
      acceptedPasswords: [],
      organizationName: '',
      supportContact: 'x'.repeat(121),
    });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining(['acceptedPasswords', 'organizationName', 'supportContact']),
      );
    }
  });

  it('rejects blank normalized passwords and inherited configuration fields', () => {
    const blankPassword = decodeConfiguration({ ...valid, acceptedPasswords: [' \u00a0 '] });
    expect(blankPassword).toMatchObject({ ok: false });
    if (!blankPassword.ok) {
      expect(blankPassword.issues).toContainEqual(
        expect.objectContaining({ path: 'acceptedPasswords[0]' }),
      );
    }

    expect(decodeConfiguration(Object.create(valid))).toMatchObject({ ok: false });
    expect(decodeConfiguration(JSON.parse(JSON.stringify(valid)))).toEqual({
      ok: true,
      value: valid,
    });
  });
});
