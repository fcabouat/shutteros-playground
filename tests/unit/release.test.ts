import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { afterEach, expect, test } from 'vitest';

const publisher = resolve('scripts/publish-release.mjs');
const preparer = resolve('scripts/release.mjs');
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'shutteros-release-test-'));
  roots.push(root);
  const repo = join(root, 'repo');
  const bin = join(root, 'bin');
  mkdirSync(repo);
  mkdirSync(bin);
  const stateFile = join(root, 'github.json');
  const initial = { release: false, pr: false, fail: '', calls: [] as string[] };
  writeFileSync(stateFile, JSON.stringify(initial));
  // Stateful GitHub double. The real publication script and real Git run;
  // only external GitHub operations are replaced, including partial failures.
  writeFileSync(
    join(bin, 'gh'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const file = process.env.FAKE_GITHUB;
const state = JSON.parse(fs.readFileSync(file));
const args = process.argv.slice(2);
const action = args.slice(0, 2).join(' ');
state.calls.push(action);
fs.writeFileSync(file, JSON.stringify(state));
if (state.fail === action) { console.error('HTTP 403: access denied'); process.exit(1); }
switch (action) {
  case 'api --paginate': console.log(state.release ? 'v0.1.1' : ''); break;
  case 'release create': state.release = true; break;
  case 'release view': if (!state.release) process.exit(1); console.log(JSON.stringify({tagName:'v0.1.1', isDraft: state.fail === 'draft', url:'https://github.com/fixture/test/releases/tag/v0.1.1'})); break;
  case 'pr list': console.log(state.pr ? 'https://github.com/fixture/test/pull/1' : ''); break;
  case 'pr create': state.pr = true; console.log('https://github.com/fixture/test/pull/1'); break;
  case 'workflow run': break;
  default: console.error('Unexpected gh call', args); process.exit(2);
}
fs.writeFileSync(file, JSON.stringify(state));
`,
    { mode: 0o755 },
  );
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    FAKE_GITHUB: stateFile,
    GITHUB_REPOSITORY: 'fixture/test',
    GITHUB_STEP_SUMMARY: join(root, 'summary.md'),
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.invalid',
  };
  const execute = (command: string, ...args: string[]) =>
    execFileSync(command, args, {
      cwd: repo,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const git = (...args: string[]) => execute('git', ...args);
  git('init', '-b', 'main');
  writeFileSync(
    join(repo, 'package.json'),
    JSON.stringify({ name: 'shutteros-playground', private: true, version: '0.1.1' }),
  );
  writeFileSync(join(repo, 'CHANGELOG.md'), '# Changelog\n\n## 0.1.1\n\nRelease automation.\n');
  git('add', '.');
  git('commit', '-m', 'fixture');
  git('init', '--bare', join(root, 'remote.git'));
  git('remote', 'add', 'origin', join(root, 'remote.git'));
  git('push', 'origin', 'main', 'main:develop');
  writeFileSync(join(repo, 'released.txt'), 'New release content');
  git('add', '.');
  git('commit', '-m', 'release');
  git('push', 'origin', 'main');
  const state = () => JSON.parse(readFileSync(stateFile, 'utf8')) as typeof initial;
  const fail = (value: string) =>
    writeFileSync(stateFile, JSON.stringify({ ...state(), fail: value }));
  return {
    root,
    repo,
    git,
    execute,
    state,
    fail,
    publish: () => execute(process.execPath, publisher),
  };
}

test('creates the remote tag, release and integration PR; retry creates no duplicates', () => {
  const f = fixture();
  f.publish();
  const tag = f.git('rev-parse', 'v0.1.1');
  f.publish();
  expect(f.git('rev-parse', 'v0.1.1^{}')).toBe(f.git('rev-parse', 'HEAD'));
  expect(f.git('ls-remote', 'origin', 'refs/tags/v0.1.1')).toContain(tag);
  expect(f.state().calls.filter((call) => call === 'release create')).toHaveLength(1);
  expect(f.state().calls.filter((call) => call === 'pr create')).toHaveLength(1);
  expect(readFileSync(join(f.root, 'summary.md'), 'utf8')).toContain('Published release: https://');
});

test.each(['release create', 'pr create', 'workflow run'])('recovers after %s fails', (action) => {
  const f = fixture();
  f.fail(action);
  expect(f.publish).toThrow();
  const tag = f.git('rev-parse', 'v0.1.1');
  expect(readFileSync(join(f.root, 'summary.md'), 'utf8')).toContain('Publication incomplete');
  f.fail('');
  f.publish();
  expect(f.state().release && f.state().pr).toBe(true);
  expect(f.git('rev-parse', 'v0.1.1')).toBe(tag);
});

test('access denial does not masquerade as an absent release or create a tag', () => {
  const f = fixture();
  f.fail('api --paginate');
  expect(f.publish).toThrow();
  expect(f.git('tag', '--list')).toBe('');
  expect(f.state().calls).toEqual(['api --paginate']);
});

test('does not claim a draft is published', () => {
  const f = fixture();
  f.fail('draft');
  expect(f.publish).toThrow();
  expect(f.state().pr).toBe(false);
});

test('recovers when an earlier attempt created only a local tag', () => {
  const f = fixture();
  f.git('tag', '-a', 'v0.1.1', '-m', 'release');
  f.publish();
  expect(f.git('ls-remote', 'origin', 'refs/tags/v0.1.1')).toContain(f.git('rev-parse', 'v0.1.1'));
});

test('allows a corrected current main without a tag, but rejects stale checkouts and tagged versions', () => {
  const f = fixture();
  f.git('commit', '--allow-empty', '-m', 'fix publisher');
  expect(f.publish).toThrow();
  f.git('push', 'origin', 'main');
  f.publish();
  const tag = f.git('rev-parse', 'v0.1.1');
  f.git('commit', '--allow-empty', '-m', 'another fix');
  f.git('push', 'origin', 'main');
  expect(f.publish).toThrow();
  expect(f.git('rev-parse', 'v0.1.1')).toBe(tag);
});

test('failed preparation preserves develop and changesets; retry uses real Changesets', () => {
  const f = fixture();
  f.git('switch', '-c', 'develop');
  mkdirSync(join(f.repo, '.changeset'));
  mkdirSync(join(f.repo, 'packages/core'), { recursive: true });
  writeFileSync(
    join(f.repo, '.changeset/config.json'),
    readFileSync(resolve('.changeset/config.json')),
  );
  writeFileSync(
    join(f.repo, 'packages/core/package.json'),
    JSON.stringify({ name: '@shutteros/core', private: true, version: '0.1.1' }),
  );
  writeFileSync(join(f.repo, 'pnpm-workspace.yaml'), 'packages:\n  - .\n  - packages/*\n');
  writeFileSync(join(f.repo, 'pnpm-lock.yaml'), '');
  writeFileSync(join(f.repo, '.gitignore'), 'node_modules/\n');
  writeFileSync(
    join(f.repo, '.changeset/fix.md'),
    "---\n'shutteros-playground': patch\n---\n\nImprove recovery.\n",
  );
  const bins = join(f.repo, 'node_modules/.bin');
  mkdirSync(bins, { recursive: true });
  // Use the real CLI and a failing formatter to interrupt after versioning.
  const wrapper = (name: string, body: string) =>
    writeFileSync(join(bins, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  wrapper('changeset', `exec '${resolve('node_modules/.bin/changeset')}' "$@"`);
  wrapper('prettier', 'exit 1');
  f.git('add', '.');
  f.git('commit', '-m', 'pending changeset');
  f.git('push', 'origin', 'develop');
  const before = f.git('rev-parse', 'HEAD');
  const prepare = () => f.execute(process.execPath, preparer, 'prepare');
  expect(prepare).toThrow();
  expect(f.git('rev-parse', 'HEAD')).toBe(before);
  expect(f.git('status', '--porcelain')).toBe('');
  expect(f.git('branch', '--list', 'release/0.1.2')).toBe('');
  expect(existsSync(join(f.repo, '.changeset/fix.md'))).toBe(true);
  wrapper('prettier', `exec '${resolve('node_modules/.bin/prettier')}' "$@"`);
  prepare();
  expect(f.git('branch', '--show-current')).toBe('release/0.1.2');
  expect(JSON.parse(readFileSync(join(f.repo, 'package.json'), 'utf8')).version).toBe('0.1.2');
  expect(JSON.parse(readFileSync(join(f.repo, 'packages/core/package.json'), 'utf8')).version).toBe(
    '0.1.2',
  );
  expect(f.git('status', '--porcelain')).toBe('');
  f.git('switch', 'develop');
  expect(prepare).toThrow();
  expect(f.git('rev-parse', 'HEAD')).toBe(before);
  expect(f.git('status', '--porcelain')).toBe('');
}, 15000);
