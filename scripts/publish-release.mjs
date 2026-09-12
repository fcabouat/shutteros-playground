import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const run = (command, ...args) => execFileSync(command, args, { stdio: 'inherit' });
const read = (command, ...args) => execFileSync(command, args, { encoding: 'utf8' }).trim();
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected a stable version.');
const tag = `v${version}`;
const sha = read('git', 'rev-parse', 'HEAD');
// Never move a published tag. A retry may reuse only the very same commit.
const tags = read('git', 'tag', '--list', tag);
if (tags) {
  if (read('git', 'rev-parse', `${tag}^{}`) !== sha) {
    throw new Error(`${tag} already belongs to another commit. Prepare a new version.`);
  }
} else {
  run('git', 'config', 'user.name', 'github-actions[bot]');
  run('git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
  run('git', 'tag', '-a', tag, '-m', `ShutterOS Playground ${tag}`);
  run('git', 'push', 'origin', `refs/tags/${tag}`);
}
const releases = read(
  'gh',
  'api',
  '--paginate',
  `repos/${process.env.GITHUB_REPOSITORY}/releases`,
  '--jq',
  '.[].tag_name',
).split('\n');
if (!releases.includes(tag)) {
  run(
    'gh',
    'release',
    'create',
    tag,
    '--verify-tag',
    '--title',
    `ShutterOS Playground ${tag}`,
    '--notes-file',
    'CHANGELOG.md',
  );
}
// The integration PR remains a human decision. Dispatch verification explicitly:
// PRs opened with GITHUB_TOKEN do not start pull_request workflows themselves.
if (read('git', 'diff', '--name-only', 'origin/develop', 'HEAD')) {
  const existing = read(
    'gh',
    'pr',
    'list',
    '--head',
    'main',
    '--base',
    'develop',
    '--json',
    'url',
    '--jq',
    '.[0].url // empty',
  );
  if (!existing) {
    run(
      'gh',
      'pr',
      'create',
      '--head',
      'main',
      '--base',
      'develop',
      '--title',
      `Sync ${tag} into develop`,
      '--body',
      'Bring the released versions and changelogs back to develop. Merge after verification; keep main.',
    );
  }
  run('gh', 'workflow', 'run', 'ci.yml', '--ref', 'main');
}
