import { execFileSync } from 'node:child_process';
import { afterEach, expect, test } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve('scripts/prepare-release-ci.mjs');
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture({ changeset = true, labeled = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'shutteros-prepare-ci-'));
  roots.push(root);
  const repo = join(root, 'repo');
  const bin = join(root, 'bin');
  const stateFile = join(root, 'github.json');
  mkdirSync(repo);
  mkdirSync(bin);
  const initial = {
    requests: labeled
      ? [{ number: 17, url: 'https://example.test/17', mergeCommit: { oid: '' } }]
      : [],
    open: [] as Record<string, unknown>[],
    edits: [] as number[],
    calls: [] as string[],
    failCreate: false,
  };
  writeFileSync(stateFile, JSON.stringify(initial));
  writeFileSync(
    join(bin, 'gh'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const cp = require('node:child_process');
const file = process.env.FAKE_GITHUB;
const state = JSON.parse(fs.readFileSync(file));
const args = process.argv.slice(2);
const action = args.slice(0, 2).join(' ');
state.calls.push(args.join(' '));
if (action === 'pr list') {
  console.log(JSON.stringify(args.includes('merged') ? state.requests : state.open));
} else if (action === 'pr create') {
  if (state.failCreate) { fs.writeFileSync(file, JSON.stringify(state)); process.exit(1); }
  const branch = args[args.indexOf('--head') + 1];
  const oid = cp.execFileSync('git', ['rev-parse', branch], {encoding:'utf8'}).trim();
  state.open = [{url:'https://example.test/release', headRefName:branch, headRefOid:oid, baseRefName:'main', isCrossRepository:false}];
  console.log('https://example.test/release');
} else if (action === 'pr view') {
  console.log(JSON.stringify({number: 19}));
} else if (action === 'pr edit') {
  state.edits.push(Number(args[2]));
} else if (action !== 'workflow run') {
  console.error('Unexpected gh call', args); process.exit(2);
}
fs.writeFileSync(file, JSON.stringify(state));
`,
    { mode: 0o755 },
  );
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    FAKE_GITHUB: stateFile,
    GITHUB_STEP_SUMMARY: join(root, 'summary.md'),
    GITHUB_OUTPUT: join(root, 'output.txt'),
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
  git('init', '-b', 'develop');
  mkdirSync(join(repo, '.changeset'));
  mkdirSync(join(repo, 'packages/core'), { recursive: true });
  writeFileSync(
    join(repo, '.changeset/config.json'),
    readFileSync(resolve('.changeset/config.json')),
  );
  writeFileSync(
    join(repo, 'package.json'),
    JSON.stringify({ name: 'shutteros-playground', private: true, version: '0.2.0' }),
  );
  writeFileSync(
    join(repo, 'packages/core/package.json'),
    JSON.stringify({ name: '@shutteros/core', private: true, version: '0.2.0' }),
  );
  writeFileSync(join(repo, 'CHANGELOG.md'), '# Changelog\n');
  writeFileSync(join(repo, 'packages/core/CHANGELOG.md'), '# Changelog\n');
  writeFileSync(join(repo, 'pnpm-workspace.yaml'), 'packages:\n  - .\n  - packages/*\n');
  writeFileSync(join(repo, 'pnpm-lock.yaml'), '');
  writeFileSync(join(repo, '.gitignore'), 'node_modules/\n');
  if (changeset)
    writeFileSync(
      join(repo, '.changeset/release.md'),
      "---\n'shutteros-playground': minor\n---\n\nRelease.\n",
    );
  const tools = join(repo, 'node_modules/.bin');
  mkdirSync(tools, { recursive: true });
  for (const name of ['changeset', 'prettier'])
    writeFileSync(
      join(tools, name),
      `#!/bin/sh\nexec '${resolve(`node_modules/.bin/${name}`)}' "$@"\n`,
      {
        mode: 0o755,
      },
    );
  git('add', '.');
  git('commit', '-m', 'develop');
  git('init', '--bare', join(root, 'remote.git'));
  git('remote', 'add', 'origin', join(root, 'remote.git'));
  git('push', '-u', 'origin', 'develop');
  const verified = git('rev-parse', 'HEAD');
  if (labeled) {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    state.requests[0].mergeCommit.oid = verified;
    writeFileSync(stateFile, JSON.stringify(state));
  }
  const state = () => JSON.parse(readFileSync(stateFile, 'utf8')) as typeof initial;
  const update = (values: Partial<typeof initial>) =>
    writeFileSync(stateFile, JSON.stringify({ ...state(), ...values }));
  const run = (extra: Record<string, string> = {}, ...args: string[]) =>
    execFileSync(process.execPath, [script, ...args], {
      cwd: repo,
      env: { ...env, GITHUB_SHA: verified, ...extra },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  return { root, repo, git, state, update, run, verified };
}

test('no Changeset is a no-op without changing Git', () => {
  const f = fixture({ changeset: false, labeled: false });
  expect(f.run()).toContain('No pending Changeset');
  expect(f.git('branch', '--list', 'release/*')).toBe('');
});

test('manual request prepares only a release branch and pull request', () => {
  const f = fixture({ labeled: false });
  f.run();
  expect(f.git('ls-remote', '--heads', 'origin', 'release/0.3.0')).toContain(
    'refs/heads/release/0.3.0',
  );
  expect(f.git('ls-remote', '--heads', 'origin', 'main')).toBe('');
  expect(f.git('ls-remote', '--tags', 'origin')).toBe('');
  expect(f.state().open).toHaveLength(1);
  expect(
    f
      .state()
      .calls.some((call: string) =>
        call.includes('--title chore(release): merge v0.3.0 into main'),
      ),
  ).toBe(true);
});

test('prepares from a CI checkout with detached HEAD and no local develop branch', () => {
  const f = fixture();
  f.git('switch', '--detach', f.verified);
  f.git('branch', '-D', 'develop');
  expect(f.git('branch', '--list', 'develop')).toBe('');
  f.run();
  expect(f.git('rev-parse', 'develop')).toBe(f.verified);
  expect(f.git('rev-parse', 'release/0.3.0^')).toBe(f.verified);
  expect(f.git('ls-remote', '--heads', 'origin', 'develop')).toContain(f.verified);
  expect(f.git('ls-remote', '--tags', 'origin')).toBe('');
  expect(f.state().open).toHaveLength(1);
});

test('retry after PR creation failure pushes the prepared branch', () => {
  const f = fixture();
  f.update({ failCreate: true });
  expect(() => f.run()).toThrow();
  expect(f.state().edits).toEqual([]);
  f.update({ failCreate: false });
  f.git('switch', 'develop');
  f.run();
  expect(f.git('ls-remote', '--heads', 'origin', 'release/0.3.0')).toContain(
    'refs/heads/release/0.3.0',
  );
});

test('existing delivery PR resumes through CI without creating another release', () => {
  const f = fixture();
  f.git('branch', 'release/0.3.0');
  f.git('switch', 'develop');
  f.update({
    open: [
      {
        number: 18,
        url: 'https://example.test/release',
        headRefName: 'release/0.3.0',
        headRefOid: f.verified,
        baseRefName: 'main',
        isCrossRepository: false,
      },
    ],
  });
  f.run();
  expect(
    f
      .state()
      .calls.some((call: string) =>
        call.includes('workflow run ci.yml --ref release/0.3.0 -f release_pr=18'),
      ),
  ).toBe(true);
});

test('existing return PR resumes through CI', () => {
  const f = fixture();
  f.update({
    open: [
      {
        number: 20,
        url: 'https://example.test/return',
        headRefName: 'release/0.2.0',
        headRefOid: f.verified,
        baseRefName: 'develop',
        isCrossRepository: false,
      },
    ],
  });
  f.run();
  expect(
    f
      .state()
      .calls.some((call: string) =>
        call.includes('workflow run ci.yml --ref release/0.2.0 -f release_pr=20'),
      ),
  ).toBe(true);
});

test('a superseded verified develop run defers without preparing', () => {
  const f = fixture();
  f.git('commit', '--allow-empty', '-m', 'advanced develop');
  f.git('push', 'origin', 'develop');
  expect(() => f.run()).toThrow(/Develop advanced/);
  expect(f.git('branch', '--list', 'release/0.3.0')).toBe('');
});

test('a checkout other than the verified develop commit is rejected', () => {
  const f = fixture();
  f.git('commit', '--allow-empty', '-m', 'unverified checkout');
  expect(() => f.run()).toThrow(/Checkout differs from the verified commit/);
  expect(f.state().edits).toEqual([]);
  expect(f.git('branch', '--list', 'release/0.3.0')).toBe('');
});

test('no application Changeset acknowledges the request without creating a version', () => {
  const f = fixture({ changeset: false });
  expect(f.run()).toContain('No pending Changeset');
  expect(f.state().edits).toEqual([]);
  expect(existsSync(join(f.repo, '.changeset/release.md'))).toBe(false);
  expect(f.git('branch', '--list', 'release/*')).toBe('');
});
