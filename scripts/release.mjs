import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const run = (command, ...args) => execFileSync(command, args, { stdio: 'inherit' });
const read = (command, ...args) => execFileSync(command, args, { encoding: 'utf8' }).trim();
const version = () => JSON.parse(readFileSync('package.json', 'utf8')).version;
const fail = (message) => {
  throw new Error(message);
};
const branch = () => read('git', 'branch', '--show-current');
const clean = () => {
  if (read('git', 'status', '--porcelain')) fail('Commit or stash your changes first.');
};

// Preparation is local; pushing and opening the PR are a separate, retryable step.
// Refuse stale branches so a release cannot silently omit merged work.
if (process.argv[2] === 'prepare') {
  if (branch() !== 'develop') fail('Start from develop.');
  clean();
  run('git', 'fetch', 'origin');
  if (read('git', 'rev-parse', 'HEAD') !== read('git', 'rev-parse', 'origin/develop')) {
    fail('Synchronize develop with origin/develop before preparing a release.');
  }
  const previous = version();
  run('pnpm', 'exec', 'changeset', 'version');
  const next = version();
  if (next === previous) fail('No pending changeset for the application.');
  if (!/^\d+\.\d+\.\d+$/.test(next)) fail('Only stable releases are supported.');
  run('git', 'switch', '-c', `release/${next}`);
  run(
    'pnpm',
    'exec',
    'prettier',
    '--write',
    'package.json',
    'packages/core/package.json',
    'CHANGELOG.md',
    'packages/core/CHANGELOG.md',
  );
  run(
    'git',
    'add',
    '.changeset',
    'package.json',
    'packages/core/package.json',
    'pnpm-lock.yaml',
    'CHANGELOG.md',
    'packages/core/CHANGELOG.md',
  );
  run('git', 'commit', '-m', `chore: release v${next}`);
  console.log('Ready. Run pnpm release:push to push and open the release PR.');
} else if (process.argv[2] === 'push') {
  clean();
  const next = version();
  if (branch() !== `release/${next}`) fail('Run from the prepared release branch.');
  run('gh', 'auth', 'status');
  run('git', 'push', '--set-upstream', 'origin', branch());
  const existing = read(
    'gh',
    'pr',
    'list',
    '--head',
    branch(),
    '--base',
    'main',
    '--json',
    'url',
    '--jq',
    '.[0].url // empty',
  );
  if (existing) console.log(existing);
  else
    run(
      'gh',
      'pr',
      'create',
      '--base',
      'main',
      '--head',
      branch(),
      '--title',
      `Release v${next}`,
      '--body',
      'Apply the prepared versions and changelogs. After verification and merge, CI creates the release tag and proposes synchronization back to develop.',
    );
} else {
  fail('Usage: node scripts/release.mjs prepare|push');
}
