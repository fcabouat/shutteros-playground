import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

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
const releaseType = process.env.RELEASE_TYPE ?? 'auto';
if (!['auto', 'patch', 'minor', 'major'].includes(releaseType))
  fail('RELEASE_TYPE must be auto, patch, minor, or major.');
const changeset = resolve('node_modules/.bin/changeset');
const prettier = resolve('node_modules/.bin/prettier');
const disposablePlan = (start, use) => {
  const temporary = mkdtempSync(join(tmpdir(), 'shutteros-prepare-'));
  const checkout = join(temporary, 'checkout');
  let added = false;
  try {
    run('git', 'worktree', 'add', '--detach', checkout, start);
    added = true;
    symlinkSync(resolve('node_modules'), join(checkout, 'node_modules'), 'dir');
    if (releaseType !== 'auto') {
      writeFileSync(
        join(checkout, `.changeset/requested-${basename(temporary)}.md`),
        `---\n'shutteros-playground': ${releaseType}\n---\n\nMaintenance release.\n`,
        { flag: 'wx' },
      );
    }
    const report = join(temporary, 'plan.json');
    execFileSync(changeset, ['status', '--output', report], { cwd: checkout, stdio: 'inherit' });
    return use({ checkout, plan: JSON.parse(readFileSync(report, 'utf8')) });
  } finally {
    try {
      if (added) run('git', 'worktree', 'remove', '--force', checkout);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
};

// Preparation is local; pushing and opening the PR are a separate, retryable step.
// Refuse stale branches so a release cannot silently omit merged work.
if (process.argv[2] === 'plan') {
  const output = process.argv[3];
  if (!output) fail('Usage: node scripts/release.mjs plan <output.json>');
  clean();
  disposablePlan(read('git', 'rev-parse', 'HEAD'), ({ plan }) =>
    writeFileSync(resolve(output), `${JSON.stringify(plan, null, 2)}\n`),
  );
} else if (process.argv[2] === 'prepare') {
  if (branch() !== 'develop') fail('Start from develop.');
  clean();
  run('git', 'fetch', 'origin');
  if (read('git', 'rev-parse', 'HEAD') !== read('git', 'rev-parse', 'origin/develop')) {
    fail('Synchronize develop with origin/develop before preparing a release.');
  }
  let releaseBranch;
  let created = false;
  let committed = false;
  const start = read('git', 'rev-parse', 'HEAD');
  try {
    disposablePlan(start, ({ checkout, plan }) => {
      const next = plan.releases.find((item) => item.name === 'shutteros-playground')?.newVersion;
      if (!next || !/^\d+\.\d+\.\d+$/.test(next))
        fail('No stable application release in pending changesets.');
      releaseBranch = `release/${next}`;
      if (
        read('git', 'branch', '--list', releaseBranch) ||
        read('git', 'branch', '-r', '--list', `origin/${releaseBranch}`)
      ) {
        fail(`${releaseBranch} already exists. Resume that release instead.`);
      }
      const inCheckout = (command, ...args) =>
        execFileSync(command, args, { cwd: checkout, stdio: 'inherit' });
      inCheckout('git', 'switch', '-c', releaseBranch);
      created = true;
      inCheckout(changeset, 'version');
      if (JSON.parse(readFileSync(join(checkout, 'package.json'), 'utf8')).version !== next)
        fail('Changesets plan changed during preparation.');
      inCheckout(
        prettier,
        '--write',
        'package.json',
        'packages/core/package.json',
        'CHANGELOG.md',
        'packages/core/CHANGELOG.md',
      );
      inCheckout(
        'git',
        'add',
        '.changeset',
        'package.json',
        'packages/core/package.json',
        'pnpm-lock.yaml',
        'CHANGELOG.md',
        'packages/core/CHANGELOG.md',
      );
      inCheckout('git', 'commit', '-m', `chore: release v${next}`);
      committed = true;
    });
  } finally {
    // Compare-and-delete protects any independently advanced release ref.
    if (releaseBranch && created && !committed)
      run('git', 'update-ref', '-d', `refs/heads/${releaseBranch}`, start);
  }
  run('git', 'switch', releaseBranch);
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
  fail('Usage: node scripts/release.mjs plan <output.json>|prepare|push');
}
