import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

const run = (command, ...args) => execFileSync(command, args, { stdio: 'inherit' });
const read = (command, ...args) => execFileSync(command, args, { encoding: 'utf8' }).trim();
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected a stable version.');
const tag = `v${version}`;
const repository = process.env.GITHUB_REPOSITORY;
if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) throw new Error('Expected GITHUB_REPOSITORY.');
const summary = [];
try {
  // A manual recovery must publish current main, not an old workflow checkout.
  // Fetch failures are fatal; they are never interpreted as an absent tag.
  run(
    'git',
    'fetch',
    'origin',
    '--tags',
    '+refs/heads/main:refs/remotes/origin/main',
    '+refs/heads/develop:refs/remotes/origin/develop',
  );
  const sha = read('git', 'rev-parse', 'HEAD');
  if (sha !== read('git', 'rev-parse', 'origin/main'))
    throw new Error('Publish the current main commit.');
  const tags = read('git', 'tag', '--list', tag);
  if (tags && read('git', 'rev-parse', `${tag}^{}`) !== sha) {
    throw new Error(`${tag} already belongs to another commit. Prepare a new version.`);
  }
  // Check API access before creating a tag. gh errors (including 403/422) fail
  // normally; only a successful inventory can establish release absence.
  const releases = read(
    'gh',
    'api',
    '--paginate',
    `repos/${repository}/releases`,
    '--jq',
    '.[].tag_name',
  ).split('\n');
  const notes = readFileSync('CHANGELOG.md', 'utf8')
    .split(/^## /m)
    .find((section) => section.startsWith(`${version}\n`));
  if (!notes) throw new Error(`Missing changelog entry for ${version}.`);
  if (!tags) {
    run('git', 'config', 'user.name', 'github-actions[bot]');
    run('git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
    run('git', 'tag', '-a', tag, '-m', `ShutterOS Playground ${tag}`);
  }
  // Also push an existing local tag: a previous push may have failed after
  // creating it. A normal push still refuses a conflicting remote tag.
  run('git', 'push', 'origin', `refs/tags/${tag}`);
  summary.push(`- Tag: [${tag}](https://github.com/${repository}/tree/${tag}) → ${sha}`);
  if (!releases.includes(tag)) {
    run(
      'gh',
      'release',
      'create',
      tag,
      '--verify-tag',
      '--title',
      `ShutterOS Playground ${tag}`,
      '--notes',
      notes.slice(version.length).trim(),
    );
  }
  const release = JSON.parse(read('gh', 'release', 'view', tag, '--json', 'tagName,isDraft,url'));
  if (release.tagName !== tag || release.isDraft)
    throw new Error('Expected a published release for this tag.');
  summary.push(`- Published release: ${release.url}`);
  // Bot-created PR workflows may require approval. Explicit dispatch verifies
  // main without recursively publishing (resume_release defaults to false).
  if (read('git', 'diff', '--name-only', 'origin/develop', 'HEAD')) {
    let pr = read(
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
    if (!pr)
      pr = read(
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
        'Merge with a merge commit after verification to preserve release ancestry. Keep main.',
      );
    summary.push(`- Integration PR (human merge required): ${pr}`);
    run('gh', 'workflow', 'run', 'ci.yml', '--ref', 'main');
  } else {
    summary.push('- develop already has the published content.');
  }
} catch (error) {
  summary.push(
    '- Publication incomplete. Inspect the failed step; completed stages above are preserved for retry.',
  );
  throw error;
} finally {
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Release publication\n\n${summary.join('\n')}\n`,
    );
}
