import { execFileSync } from 'node:child_process';

const run = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: 'inherit', ...options });
const read = (command, args) => execFileSync(command, args, { encoding: 'utf8' }).trim();
const fail = (message) => {
  throw new Error(message);
};

const requested = process.argv.slice(2);
if (
  requested.length > 1 ||
  (requested[0] && !['auto', 'patch', 'minor', 'major'].includes(requested[0]))
)
  fail('Usage: pnpm release [auto|patch|minor|major]');
const releaseType = requested[0] ?? 'auto';
if (read('git', ['status', '--porcelain'])) fail('Commit or stash your changes first.');
if (read('git', ['branch', '--show-current']) !== 'develop') fail('Start from the develop branch.');

run('gh', ['auth', 'status']);
run('git', ['fetch', 'origin']);

const local = read('git', ['rev-parse', 'HEAD']);
const remote = read('git', ['rev-parse', 'origin/develop']);
if (local !== remote) {
  try {
    read('git', ['merge-base', '--is-ancestor', local, remote]);
  } catch {
    fail('Develop has diverged from or is ahead of origin/develop.');
  }
  run('git', ['merge', '--ff-only', 'origin/develop']);
}

run('gh', [
  'workflow',
  'run',
  'release.yml',
  '--ref',
  'develop',
  '-f',
  `release_type=${releaseType}`,
]);
const origin = read('git', ['remote', 'get-url', 'origin'])
  .replace(/^https?:\/\/[^/]+\//, '')
  .replace(/^git@[^:]+:/, '')
  .replace(/\.git$/, '');
const repository = /^[^/]+\/[^/]+$/.test(origin) ? origin : process.env.GITHUB_REPOSITORY;
if (!/^[^/]+\/[^/]+$/.test(repository ?? ''))
  fail('Could not determine the origin GitHub repository.');
console.log(
  `Release preparation dispatched: https://github.com/${repository}/actions/workflows/release.yml`,
);
