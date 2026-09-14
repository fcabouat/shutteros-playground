import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';

const launcher = resolve('scripts/start-release.mjs');
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'release-launcher-'));
  roots.push(root);
  const repo = join(root, 'repo');
  const remote = join(root, 'remote.git');
  const bin = join(root, 'bin');
  mkdirSync(repo);
  mkdirSync(bin);
  const state = join(root, 'state');
  writeFileSync(state, '');
  writeFileSync(
    join(bin, 'gh'),
    `#!/usr/bin/env node
const fs=require('fs'); const f=process.env.RELEASE_STATE; const a=process.argv.slice(2);
if (a[0]==='auth' && process.env.FAIL_AUTH) process.exit(1); fs.appendFileSync(f,a.join(' ')+'\\n');
`,
    { mode: 0o755 },
  );
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    RELEASE_STATE: state,
    GITHUB_REPOSITORY: 'fixture/test',
  };
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: repo,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init', '-b', 'develop');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  writeFileSync(join(repo, 'tracked.txt'), 'initial');
  git('add', '.');
  git('commit', '-m', 'initial');
  const initial = git('rev-parse', 'HEAD');
  git('tag', 'fixture-tag');
  git('init', '--bare', '-b', 'develop', remote);
  git('remote', 'add', 'origin', remote);
  git('push', 'origin', 'develop');
  const run = () =>
    execFileSync(process.execPath, [launcher], {
      cwd: repo,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const runWithArgs = (...args: string[]) =>
    execFileSync(process.execPath, [launcher, ...args], {
      cwd: repo,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  return {
    root,
    repo,
    remote,
    env,
    git,
    run,
    runWithArgs,
    initial,
    calls: () => readFileSync(state, 'utf8'),
  };
}

test('dispatches from clean develop without changing tags', () => {
  const f = fixture();
  expect(f.run()).toContain('/actions/workflows/release.yml');
  expect(f.git('tag')).toBe('fixture-tag');
  expect(f.calls()).toContain('workflow run release.yml --ref develop -f release_type=auto');
});

test.each(['patch', 'minor', 'major'])('passes explicit %s release type to CI', (releaseType) => {
  const f = fixture();
  f.runWithArgs(releaseType);
  expect(f.calls()).toContain(`release_type=${releaseType}`);
});

test('rejects invalid or extra release arguments before GitHub access', () => {
  for (const args of [['bogus'], ['patch', 'minor']]) {
    const f = fixture();
    expect(() => f.runWithArgs(...args)).toThrow(/Usage/);
    expect(f.calls()).toBe('');
  }
});

test('fast-forwards develop when it is behind origin', () => {
  const f = fixture();
  writeFileSync(join(f.repo, 'tracked.txt'), 'remote');
  f.git('add', '.');
  f.git('commit', '-m', 'remote');
  f.git('push', 'origin', 'develop');
  f.git('reset', '--hard', f.initial);
  f.run();
  expect(f.git('rev-parse', 'HEAD')).not.toBe(f.initial);
});

test('rejects ahead and diverged develop', () => {
  const ahead = fixture();
  ahead.git('commit', '--allow-empty', '-m', 'ahead');
  expect(ahead.run).toThrow(/diverged|ahead/);
  const divergent = fixture();
  const clone = join(divergent.root, 'clone');
  execFileSync('git', ['clone', divergent.remote, clone], { stdio: 'pipe' });
  execFileSync('git', ['-C', clone, 'switch', 'develop'], { stdio: 'pipe' });
  execFileSync('git', ['-C', clone, 'config', 'user.name', 'Other']);
  execFileSync('git', ['-C', clone, 'config', 'user.email', 'other@example.invalid']);
  execFileSync('git', ['-C', clone, 'commit', '--allow-empty', '-m', 'remote']);
  execFileSync('git', ['-C', clone, 'push', 'origin', 'develop'], { stdio: 'pipe' });
  divergent.git('commit', '--allow-empty', '-m', 'local');
  expect(divergent.run).toThrow(/diverged|ahead/);
});

test('rejects dirty and non-develop branches before GitHub mutations', () => {
  const dirty = fixture();
  writeFileSync(join(dirty.repo, 'dirty.txt'), 'x');
  expect(dirty.run).toThrow(/Commit or stash/);
  expect(dirty.calls()).toBe('');
  const branch = fixture();
  branch.git('switch', '-c', 'feature/work');
  expect(branch.run).toThrow(/develop/);
  expect(branch.calls()).toBe('');
});

test('authentication failure prevents fetch and dispatch', () => {
  const f = fixture();
  f.env.FAIL_AUTH = '1';
  expect(f.run).toThrow();
  expect(f.calls()).toBe('');
});
