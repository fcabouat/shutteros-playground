import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isVersion, nextVersion, readVersion, writeVersion } from '../../scripts/version.mjs';

describe('version bump rules', () => {
  it('bumps each semver component and resets the lower ones', () => {
    expect(nextVersion('0.3.1', 'patch')).toBe('0.3.2');
    expect(nextVersion('0.3.1', 'minor')).toBe('0.4.0');
    expect(nextVersion('0.3.1', 'major')).toBe('1.0.0');
  });
  it('accepts an explicit version with or without the tag prefix', () => {
    expect(nextVersion('0.3.1', '1.2.3')).toBe('1.2.3');
    expect(nextVersion('0.3.1', 'v1.2.3')).toBe('1.2.3');
  });
  it('rejects anything that is not a bump keyword or X.Y.Z', () => {
    for (const request of ['1.2', '01.2.3', 'latest', '', '1.2.3-beta']) {
      expect(() => nextVersion('0.3.1', request)).toThrow();
    }
    expect(() => nextVersion('0.3', 'patch')).toThrow();
    expect(isVersion('1.0.0')).toBe(true);
    expect(isVersion('v1.0.0')).toBe(false);
  });
});

describe('version files', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'shutteros-version-'));
    mkdirSync(join(root, 'packages/core'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{\n  "name": "root",\n  "version": "0.3.1"\n}\n');
    writeFileSync(
      join(root, 'packages/core/package.json'),
      '{\n  "name": "@shutteros/core",\n  "version": "0.3.1"\n}\n',
    );
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('writes the same version to both packages and keeps the file layout', () => {
    writeVersion(root, '0.4.0');
    expect(readVersion(root)).toBe('0.4.0');
    expect(readFileSync(join(root, 'packages/core/package.json'), 'utf8')).toBe(
      '{\n  "name": "@shutteros/core",\n  "version": "0.4.0"\n}\n',
    );
  });
  it('refuses to write an invalid version and leaves files untouched', () => {
    expect(() => writeVersion(root, '0.4')).toThrow();
    expect(readVersion(root)).toBe('0.3.1');
  });
});
