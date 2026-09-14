import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isVersion,
  nextVersion,
  readVersion,
  readVersions,
  validateTag,
  writeVersion,
} from '../../scripts/version.mjs';

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
    mkdirSync(join(root, 'packages/components'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{\n  "name": "root",\n  "version": "0.3.1"\n}\n');
    writeFileSync(
      join(root, 'packages/core/package.json'),
      '{\n  "name": "@shutteros/core",\n  "version": "0.3.1"\n}\n',
    );
    writeFileSync(
      join(root, 'packages/components/package.json'),
      '{\n  "name": "@shutteros/components",\n  "version": "0.3.1"\n}\n',
    );
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('writes the same version to every package and keeps the file layout', () => {
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

describe('release tag validation', () => {
  let root: string;
  let taggedCommit: string;
  let mainBeforeRelease: string;

  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'shutteros-release-tag-'));
    mkdirSync(join(root, 'packages/core'), { recursive: true });
    mkdirSync(join(root, 'packages/components'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{"name":"root","version":"0.3.1"}\n');
    writeFileSync(
      join(root, 'packages/core/package.json'),
      '{"name":"@shutteros/core","version":"0.3.1"}\n',
    );
    writeFileSync(
      join(root, 'packages/components/package.json'),
      '{"name":"@shutteros/components","version":"0.3.1"}\n',
    );
    git('init', '-b', 'main');
    git('config', 'user.name', 'Release Test');
    git('config', 'user.email', 'release@example.invalid');
    git('add', '.');
    git('commit', '-m', 'initial');
    mainBeforeRelease = git('rev-parse', 'HEAD');
    git('switch', '-c', 'develop');
    git('switch', '-c', 'release/0.4.0');
    writeVersion(root, '0.4.0');
    git('add', 'package.json', 'packages/core/package.json', 'packages/components/package.json');
    git('commit', '-m', 'prepare delivery');

    git('switch', 'main');
    git('merge', '--no-ff', '-m', 'arbitrary merge subject', 'release/0.4.0');
    taggedCommit = git('rev-parse', 'HEAD');
    git('tag', '-a', 'v0.4.0', '-m', 'ShutterOS Playground v0.4.0');
    git('switch', 'develop');
    git('merge', '--no-ff', '-m', 'another arbitrary subject', 'release/0.4.0');
    git('update-ref', 'refs/remotes/origin/main', taggedCommit);
    git('update-ref', 'refs/remotes/origin/develop', git('rev-parse', 'develop'));
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('accepts aligned packages and the two-merge Gitflow finish graph', () => {
    expect(validateTag(root, 'v0.4.0', taggedCommit)).toBe('0.4.0');
    expect(readVersions(root, taggedCommit)).toEqual(['0.4.0', '0.4.0', '0.4.0']);
  });

  it('requires an annotated tag on the exact tested commit', () => {
    git('tag', 'v0.4.1', taggedCommit);
    expect(() => validateTag(root, 'v0.4.1', taggedCommit)).toThrow(/annotated tag/);
    expect(() => validateTag(root, 'v0.4.0', mainBeforeRelease)).toThrow(/not tested commit/);
  });

  it('requires every package version to match the tag', () => {
    git('tag', '-a', 'v0.4.2', taggedCommit, '-m', 'mismatched version');
    expect(() => validateTag(root, 'v0.4.2', taggedCommit)).toThrow(
      /does not match package versions: 0\.4\.0, 0\.4\.0, 0\.4\.0/,
    );
  });

  it('requires main ancestry and the matching develop finish merge', () => {
    git('update-ref', 'refs/remotes/origin/main', mainBeforeRelease);
    expect(() => validateTag(root, 'v0.4.0', taggedCommit)).toThrow(/not on origin\/main/);
    git('update-ref', 'refs/remotes/origin/main', taggedCommit);
    git('update-ref', 'refs/remotes/origin/develop', mainBeforeRelease);
    expect(() => validateTag(root, 'v0.4.0', taggedCommit)).toThrow(/develop finish merge/);
  });
});
