import { execFileSync } from 'node:child_process';
import { afterEach, expect, test } from 'vitest';
import { join, resolve } from 'node:path';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const script = resolve('scripts/merge-release-pr.mjs');
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(base = 'main') {
  const root = mkdtempSync(join(tmpdir(), 'shutteros-merge-release-'));
  roots.push(root);
  const bin = join(root, 'bin');
  const stateFile = join(root, 'github.json');
  mkdirSync(bin);
  const head = '1'.repeat(40);
  const baseSha = '2'.repeat(40);
  const pull = {
    number: 42,
    state: 'open',
    merged: false,
    user: { login: 'release-automation[bot]' },
    head: { ref: 'release/1.2.3', sha: head, repo: { full_name: 'fixture/repo' } },
    base: { ref: base, repo: { full_name: 'fixture/repo' } },
  };
  const initial = {
    pull,
    baseSha,
    failChecks: false,
    noChecks: false,
    failApi: false,
    failDispatch: false,
    mergeFinal: true,
    changeBaseAfterChecks: false,
    changeAuthorAfterChecks: false,
    calls: [] as string[],
  };
  writeFileSync(stateFile, JSON.stringify(initial));
  writeFileSync(
    join(bin, 'gh'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const file = process.env.FAKE_GITHUB;
const state = JSON.parse(fs.readFileSync(file));
const args = process.argv.slice(2);
state.calls.push(args.join(' '));
const action = args.slice(0, 2).join(' ');
if (action === 'api repos/fixture/repo/pulls/42') {
  if (state.failApi) { fs.writeFileSync(file, JSON.stringify(state)); process.exit(1); }
  console.log(JSON.stringify(state.pull));
}
else if (action === 'api repos/fixture/repo/git/ref/heads/' + state.pull.base.ref) console.log(JSON.stringify({object:{sha:state.baseSha}}));
else if (action === 'pr checks') {
  if (state.changeBaseAfterChecks) state.baseSha = '3'.repeat(40);
  if (state.changeAuthorAfterChecks) state.pull.user.login = 'someone-else';
  if (state.failChecks || state.noChecks) { fs.writeFileSync(file, JSON.stringify(state)); process.exit(1); }
} else if (action === 'pr merge') {
  if (state.mergeFinal) { state.pull.merged = true; state.pull.state = 'closed'; }
} else if (action === 'workflow run') {
  if (state.failDispatch) { fs.writeFileSync(file, JSON.stringify(state)); process.exit(1); }
} else { console.error('Unexpected call', args); process.exit(2); }
fs.writeFileSync(file, JSON.stringify(state));
`,
    { mode: 0o755 },
  );
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    FAKE_GITHUB: stateFile,
    RELEASE_PR: '42',
    GITHUB_REPOSITORY: 'fixture/repo',
    RELEASE_HEAD_REF: 'release/1.2.3',
    RELEASE_HEAD_SHA: head,
    RELEASE_APP_SLUG: 'release-automation',
    VERIFIED_BASE_SHA: baseSha,
    GH_TOKEN: 'github-token',
    GITHUB_STEP_SUMMARY: join(root, 'summary.md'),
  };
  const state = () => JSON.parse(readFileSync(stateFile, 'utf8')) as typeof initial;
  const update = (values: Partial<typeof initial>) =>
    writeFileSync(stateFile, JSON.stringify({ ...state(), ...values }));
  const run = () =>
    execFileSync(process.execPath, [script], {
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  return { root, state, update, run, head };
}

test.each(['main', 'develop'])(
  'merges the exact head into %s with the standard subject',
  (base) => {
    const f = fixture(base);
    f.run();
    expect(f.state().pull.merged).toBe(true);
    expect(f.state().calls).toContain('pr checks 42 --watch --required --fail-fast --interval 10');
    expect(f.state().calls).toContain(
      `pr merge 42 --merge --match-head-commit ${f.head} --subject chore(release): merge v1.2.3 into ${base} --body Merge release/1.2.3 into ${base}.\n\nPull request: https://github.com/fixture/repo/pull/42`,
    );
    expect(f.state().calls).toContain(
      base === 'main'
        ? 'workflow run ci.yml --ref main -f resume_release=true'
        : 'workflow run ci.yml --ref develop',
    );
  },
);

test('an already merged PR dispatches its base without another merge', () => {
  const f = fixture('develop');
  f.update({ pull: { ...f.state().pull, merged: true, state: 'closed' } });
  f.run();
  expect(f.state().calls.some((call) => call.startsWith('pr merge'))).toBe(false);
  expect(f.state().calls).toContain('workflow run ci.yml --ref develop');
});

test('missing required checks refuses to merge', () => {
  const f = fixture();
  f.update({ noChecks: true });
  expect(f.run).toThrow();
  expect(f.state().calls.some((call) => call.startsWith('pr merge'))).toBe(false);
});

test('failed required checks stop before merge', () => {
  const f = fixture();
  f.update({ failChecks: true });
  expect(f.run).toThrow();
  expect(f.state().calls.some((call) => call.startsWith('pr merge'))).toBe(false);
  const summary = readFileSync(join(f.root, 'summary.md'), 'utf8');
  expect(summary).toContain('Phase: wait for required checks');
  expect(summary).toContain('https://github.com/fixture/repo/pull/42');
});

test('GitHub API denial stops before checks or merge', () => {
  const f = fixture();
  f.update({ failApi: true });
  expect(f.run).toThrow();
  expect(f.state().calls).toHaveLength(1);
});

test('a failed dispatch retries from the already-merged PR without merging twice', () => {
  const f = fixture();
  f.update({ failDispatch: true });
  expect(f.run).toThrow();
  expect(f.state().pull.merged).toBe(true);
  f.update({ failDispatch: false });
  f.run();
  expect(f.state().calls.filter((call) => call.startsWith('pr merge'))).toHaveLength(1);
  expect(f.state().calls.filter((call) => call.startsWith('workflow run'))).toHaveLength(2);
});

test.each([
  [
    'author',
    (pull: ReturnType<ReturnType<typeof fixture>['state']>['pull']) => ({
      ...pull,
      user: { login: 'github-actions[bot]' },
    }),
  ],
  [
    'fork',
    (pull: ReturnType<ReturnType<typeof fixture>['state']>['pull']) => ({
      ...pull,
      head: { ...pull.head, repo: { full_name: 'fork/repo' } },
    }),
  ],
  [
    'head ref',
    (pull: ReturnType<ReturnType<typeof fixture>['state']>['pull']) => ({
      ...pull,
      head: { ...pull.head, ref: 'release/9.9.9' },
    }),
  ],
  [
    'head SHA',
    (pull: ReturnType<ReturnType<typeof fixture>['state']>['pull']) => ({
      ...pull,
      head: { ...pull.head, sha: '4'.repeat(40) },
    }),
  ],
  [
    'base',
    (pull: ReturnType<ReturnType<typeof fixture>['state']>['pull']) => ({
      ...pull,
      base: { ...pull.base, ref: 'other' },
    }),
  ],
] as const)('rejects the wrong %s before checking or merging', (_label, mutate) => {
  const f = fixture();
  f.update({ pull: mutate(f.state().pull) });
  expect(f.run).toThrow(/does not match/);
  expect(f.state().calls.some((call) => call.startsWith('pr checks'))).toBe(false);
  expect(f.state().calls.some((call) => call.startsWith('pr merge'))).toBe(false);
});

test('rejects a base race and changed author after checks', () => {
  const raced = fixture();
  raced.update({ changeBaseAfterChecks: true });
  expect(raced.run).toThrow(/changed after verification/);
  expect(raced.state().calls.some((call) => call.startsWith('pr merge'))).toBe(false);
  const changedAuthor = fixture();
  changedAuthor.update({ changeAuthorAfterChecks: true });
  expect(changedAuthor.run).toThrow(/does not match/);
  expect(changedAuthor.state().calls.some((call) => call.startsWith('pr merge'))).toBe(false);
});

test('uses only the scoped workflow credential and needs no App private key', () => {
  const f = fixture();
  f.run();
  expect(f.state().pull.merged).toBe(true);
  expect(process.env.RELEASE_APP_PRIVATE_KEY).toBeUndefined();
});

test('does not treat a queued or otherwise unfinished merge as success', () => {
  const f = fixture();
  f.update({ mergeFinal: false });
  expect(f.run).toThrow(/did not report.*merged/);
  expect(f.state().calls.some((call) => call.startsWith('workflow run'))).toBe(false);
});
