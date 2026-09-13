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
    GITHUB_REF_NAME: 'release/1.2.3',
    GITHUB_SHA: head,
    VERIFIED_BASE_SHA: baseSha,
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
  return { state, update, run, head };
}

test('waits for required checks, merge-commits the exact head, and resumes publication', () => {
  const f = fixture();
  f.run();
  expect(f.state().pull.merged).toBe(true);
  expect(f.state().calls).toContain('pr checks 42 --watch --required --fail-fast --interval 10');
  expect(f.state().calls).toContain(`pr merge 42 --merge --match-head-commit ${f.head}`);
  expect(f.state().calls).toContain('workflow run ci.yml --ref main -f resume_release=true');
});

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

test('rejects changed head provenance and a base race', () => {
  const wrong = fixture();
  wrong.update({
    pull: { ...wrong.state().pull, head: { ...wrong.state().pull.head, sha: '4'.repeat(40) } },
  });
  expect(wrong.run).toThrow(/does not match/);
  const raced = fixture();
  raced.update({ changeBaseAfterChecks: true });
  expect(raced.run).toThrow(/changed after verification/);
  expect(raced.state().calls.some((call) => call.startsWith('pr merge'))).toBe(false);
});

test('does not treat a queued or otherwise unfinished merge as success', () => {
  const f = fixture();
  f.update({ mergeFinal: false });
  expect(f.run).toThrow(/did not report.*merged/);
  expect(f.state().calls.some((call) => call.startsWith('workflow run'))).toBe(false);
});
