import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { expect, test } from 'vitest';

const publisher = resolve('scripts/publish-release.mjs');

test('release publication retries safely and refuses to move an existing tag', () => {
  const root = mkdtempSync(join(tmpdir(), 'shutteros-release-test-'));
  const repo = join(root, 'repo');
  const bin = join(root, 'bin');
  mkdirSync(repo);
  mkdirSync(bin);
  // Keep GitHub entirely out of the test. Git still exercises real local refs.
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    GITHUB_REPOSITORY: 'fixture/test',
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.invalid',
  };
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: repo,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const publish = () =>
    execFileSync(process.execPath, [publisher], {
      cwd: repo,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  try {
    git('init', '-b', 'main');
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ version: '0.1.1' }));
    writeFileSync(join(repo, 'CHANGELOG.md'), '# 0.1.1\n\nRelease automation.\n');
    git('add', '.');
    git('commit', '-m', 'fixture');
    git('init', '--bare', join(root, 'remote.git'));
    git('remote', 'add', 'origin', join(root, 'remote.git'));
    git('push', 'origin', 'main:develop');
    publish();
    const tag = git('rev-parse', 'v0.1.1');
    expect(git('rev-parse', 'v0.1.1^{}')).toBe(git('rev-parse', 'HEAD'));
    publish();
    expect(git('rev-parse', 'v0.1.1')).toBe(tag);
    git('commit', '--allow-empty', '-m', 'different content');
    expect(publish).toThrow();
    expect(git('rev-parse', 'v0.1.1')).toBe(tag);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
