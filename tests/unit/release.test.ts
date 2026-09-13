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
  const initial = {
    release: false,
    pr: false,
    fail: '',
    pulls: [] as Record<string, unknown>[],
    calls: [] as string[],
  };
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
if (action.startsWith('api repos/fixture/test/commits/')) {
  console.log(JSON.stringify(state.pulls));
  process.exit(0);
}
switch (action) {
  case 'api --paginate': console.log(state.release ? 'v0.1.1' : ''); break;
  case 'release create': state.release = true; break;
  case 'release view': if (!state.release) process.exit(1); console.log(JSON.stringify({tagName:'v0.1.1', isDraft: state.fail === 'draft', url:'https://github.com/fixture/test/releases/tag/v0.1.1'})); break;
  case 'pr list': console.log(state.pr ? 'https://github.com/fixture/test/pull/2' : ''); break;
  case 'pr create': if (args[args.indexOf('--title') + 1] !== 'chore(release): merge v0.1.1 into develop') process.exit(2); state.pr = true; console.log('https://github.com/fixture/test/pull/2'); break;
  case 'pr view': console.log(JSON.stringify({number:2})); break;
  case 'workflow run': if (args[args.indexOf('--ref') + 1] !== 'release/0.1.1' || args.at(-1) !== 'release_pr=2') process.exit(2); break;
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
  git('switch', '-c', 'release/0.1.1');
  writeFileSync(join(repo, 'released.txt'), 'New release content');
  git('add', '.');
  git('commit', '-m', 'release');
  const deliverySha = git('rev-parse', 'HEAD');
  git('push', 'origin', 'release/0.1.1');
  git('switch', 'main');
  git('merge', '--no-ff', 'release/0.1.1', '-m', 'merge release');
  git('push', 'origin', 'main');
  const mergeSha = git('rev-parse', 'HEAD');
  writeFileSync(
    stateFile,
    JSON.stringify({
      ...initial,
      pulls: [
        {
          number: 1,
          merged_at: '2026-01-01T00:00:00Z',
          merge_commit_sha: mergeSha,
          base: { ref: 'main', repo: { full_name: 'fixture/test' } },
          head: {
            ref: 'release/0.1.1',
            sha: deliverySha,
            repo: { full_name: 'fixture/test' },
          },
        },
      ],
    }),
  );
  const state = () => JSON.parse(readFileSync(stateFile, 'utf8')) as typeof initial;
  const fail = (value: string) =>
    writeFileSync(stateFile, JSON.stringify({ ...state(), fail: value }));
  const updateState = (values: Partial<ReturnType<typeof state>>) =>
    writeFileSync(stateFile, JSON.stringify({ ...state(), ...values }));
  return {
    root,
    repo,
    git,
    execute,
    state,
    fail,
    updateState,
    deliverySha,
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

test('restores an auto-deleted delivery branch at the verified merged PR head', () => {
  const f = fixture();
  f.git('push', 'origin', '--delete', 'release/0.1.1');
  f.publish();
  expect(f.git('ls-remote', 'origin', 'refs/heads/release/0.1.1')).toContain(f.deliverySha);
  expect(f.state().pr).toBe(true);
  expect(f.state().calls).toContain('workflow run');
});

test('does not create another return PR after the delivery head reaches develop', () => {
  const f = fixture();
  f.git('switch', 'develop');
  f.git('merge', '--no-ff', 'release/0.1.1', '-m', 'return release');
  f.git('push', 'origin', 'develop');
  f.git('switch', 'main');
  f.publish();
  expect(f.state().pr).toBe(false);
  expect(f.state().calls).not.toContain('pr list');
  expect(f.state().calls).not.toContain('workflow run');
});

test('refuses to move a recreated delivery branch at a different commit', () => {
  const f = fixture();
  f.git('switch', 'release/0.1.1');
  f.git('commit', '--allow-empty', '-m', 'unexpected branch move');
  f.git('push', 'origin', 'release/0.1.1');
  f.git('switch', 'main');
  expect(f.publish).toThrow(/exists at a different commit/);
  expect(f.state().pr).toBe(false);
});

test('rejects merged PR provenance from the wrong repository or commit', () => {
  const f = fixture();
  const pull = f.state().pulls[0] as {
    head: { repo: { full_name: string } };
    [key: string]: unknown;
  };
  f.updateState({
    pulls: [{ ...pull, head: { ...pull.head, repo: { full_name: 'attacker/fork' } } }],
  });
  expect(f.publish).toThrow(/Expected one merged/);
  expect(f.git('tag', '--list')).toBe('');
});

function preparationFixture(existingType?: 'patch' | 'minor' | 'major') {
  const f = fixture();
  f.git('switch', '-c', 'develop', 'origin/develop');
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
  writeFileSync(join(f.repo, 'packages/core/CHANGELOG.md'), '# Changelog\n');
  writeFileSync(join(f.repo, 'pnpm-workspace.yaml'), 'packages:\n  - .\n  - packages/*\n');
  writeFileSync(join(f.repo, 'pnpm-lock.yaml'), '');
  writeFileSync(join(f.repo, '.gitignore'), 'node_modules/\n');
  if (existingType)
    writeFileSync(
      join(f.repo, '.changeset/existing.md'),
      `---\n'shutteros-playground': ${existingType}\n---\n\nExisting change.\n`,
    );
  const bins = join(f.repo, 'node_modules/.bin');
  mkdirSync(bins, { recursive: true });
  for (const name of ['changeset', 'prettier'])
    writeFileSync(
      join(bins, name),
      `#!/bin/sh\nexec '${resolve(`node_modules/.bin/${name}`)}' "$@"\n`,
      {
        mode: 0o755,
      },
    );
  f.git('add', '.');
  f.git('commit', '-m', 'release inputs');
  f.git('push', 'origin', 'develop');
  const invoke = (type: string, ...args: string[]) =>
    f.execute('env', `RELEASE_TYPE=${type}`, process.execPath, preparer, ...args);
  return { ...f, invoke };
}

test.each([
  ['patch', '0.1.2'],
  ['minor', '0.2.0'],
  ['major', '1.0.0'],
] as const)('plans an explicit %s release without a prior Changeset', (type, expected) => {
  const f = preparationFixture();
  const before = f.git('rev-parse', 'HEAD');
  const output = join(f.root, `${type}.json`);
  f.invoke(type, 'plan', output);
  const plan = JSON.parse(readFileSync(output, 'utf8'));
  expect(
    plan.releases.find((item: { name: string }) => item.name === 'shutteros-playground').newVersion,
  ).toBe(expected);
  expect(f.git('rev-parse', 'HEAD')).toBe(before);
  expect(f.git('status', '--porcelain')).toBe('');
  expect(f.git('branch', '--list', `release/${expected}`)).toBe('');
});

test('an existing minor Changeset takes precedence over an explicit patch', () => {
  const f = preparationFixture('minor');
  const output = join(f.root, 'plan.json');
  f.invoke('patch', 'plan', output);
  const plan = JSON.parse(readFileSync(output, 'utf8'));
  expect(
    plan.releases.find((item: { name: string }) => item.name === 'shutteros-playground').newVersion,
  ).toBe('0.2.0');
  expect(existsSync(join(f.repo, '.changeset/requested-release.md'))).toBe(false);
});

test('plan and prepare resolve the same explicit release and leave develop untouched', () => {
  const f = preparationFixture();
  const before = f.git('rev-parse', 'HEAD');
  const output = join(f.root, 'plan.json');
  f.invoke('minor', 'plan', output);
  const planned = JSON.parse(readFileSync(output, 'utf8')).releases.find(
    (item: { name: string }) => item.name === 'shutteros-playground',
  ).newVersion;
  f.invoke('minor', 'prepare');
  expect(planned).toBe('0.2.0');
  expect(f.git('log', '-1', '--format=%s')).toBe('chore(release): prepare v0.2.0');
  expect(f.git('branch', '--show-current')).toBe('release/0.2.0');
  expect(JSON.parse(readFileSync(join(f.repo, 'package.json'), 'utf8')).version).toBe(planned);
  expect(f.git('show', 'develop:package.json')).toContain('"version":"0.1.1"');
  expect(f.git('rev-parse', 'develop')).toBe(before);
  expect(f.git('tag', '--list')).toBe('');
});

test('preparation never deletes a pre-existing release branch at the develop tip', () => {
  const f = preparationFixture();
  const start = f.git('rev-parse', 'HEAD');
  f.git('branch', 'release/0.1.2', start);
  expect(() => f.invoke('patch', 'prepare')).toThrow(/already exists/);
  expect(f.git('rev-parse', 'release/0.1.2')).toBe(start);
  expect(f.git('branch', '--show-current')).toBe('develop');
});

test('an existing requested-release Changeset is preserved and takes precedence', () => {
  const f = preparationFixture();
  const note = join(f.repo, '.changeset/requested-release.md');
  writeFileSync(note, "---\n'shutteros-playground': major\n---\n\nUser-authored release note.\n");
  f.git('add', note);
  f.git('commit', '-m', 'requested major');
  f.git('push', 'origin', 'develop');
  const output = join(f.root, 'plan.json');
  f.invoke('patch', 'plan', output);
  const plan = JSON.parse(readFileSync(output, 'utf8'));
  expect(
    plan.releases.find((item: { name: string }) => item.name === 'shutteros-playground').newVersion,
  ).toBe('1.0.0');
  expect(readFileSync(note, 'utf8')).toContain('User-authored release note.');
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
  expect(f.state().calls.at(-1)).toBe('api --paginate');
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

test('rejects stale checkouts and a version tag that belongs to another main commit', () => {
  const f = fixture();
  f.git('commit', '--allow-empty', '-m', 'fix publisher');
  expect(f.publish).toThrow();
  f.git('switch', '--detach', 'origin/main');
  f.publish();
  const tag = f.git('rev-parse', 'v0.1.1');
  f.git('switch', 'main');
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
