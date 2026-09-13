import { releaseMessages } from './release-messages.mjs';
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
  const mergedPulls = JSON.parse(read('gh', 'api', `repos/${repository}/commits/${sha}/pulls`));
  const deliveryPulls = mergedPulls.filter((pr) => {
    const expectedHead =
      pr.head?.ref === `release/${version}` || pr.head?.ref === `hotfix/${version}`;
    return (
      expectedHead &&
      pr.merged_at &&
      pr.merge_commit_sha === sha &&
      pr.base?.ref === 'main' &&
      pr.base?.repo?.full_name === repository &&
      pr.head?.repo?.full_name === repository
    );
  });
  if (deliveryPulls.length !== 1)
    throw new Error(
      `Expected one merged release/${version} or hotfix/${version} PR for current main.`,
    );
  const deliveryPull = deliveryPulls[0];
  const deliveryBranch = deliveryPull.head.ref;
  const deliverySha = deliveryPull.head.sha;
  if (!/^[0-9a-f]{40}$/i.test(deliverySha)) throw new Error('Expected a full delivery head SHA.');
  try {
    read('git', 'cat-file', '-e', `${deliverySha}^{commit}`);
  } catch {
    run('git', 'fetch', 'origin', deliverySha);
  }
  try {
    read('git', 'merge-base', '--is-ancestor', deliverySha, sha);
  } catch {
    throw new Error(`Verified ${deliveryBranch} head is not an ancestor of current main.`);
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
  // The delivery head, rather than main, is returned to develop. This preserves
  // classic Gitflow ancestry and lets retries recognize a completed return merge.
  try {
    read('git', 'merge-base', '--is-ancestor', deliverySha, 'origin/develop');
    summary.push(`- ${deliveryBranch} is already integrated into develop.`);
  } catch {
    const remoteHead = read('git', 'ls-remote', 'origin', `refs/heads/${deliveryBranch}`).split(
      /\s+/,
    )[0];
    if (remoteHead && remoteHead !== deliverySha)
      throw new Error(`${deliveryBranch} exists at a different commit; refusing to move it.`);
    if (!remoteHead) run('git', 'push', 'origin', `${deliverySha}:refs/heads/${deliveryBranch}`);
    let pr = read(
      'gh',
      'pr',
      'list',
      '--head',
      deliveryBranch,
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
        deliveryBranch,
        '--base',
        'develop',
        '--title',
        releaseMessages(version, deliveryBranch.split('/')[0]).develop,
        '--body',
        'Return the published release to develop. Automation verifies the merge and preserves release ancestry with a merge commit.',
      );
    summary.push(`- Integration PR queued for verification and merge: ${pr}`);
    const { number } = JSON.parse(read('gh', 'pr', 'view', pr, '--json', 'number'));
    run('gh', 'workflow', 'run', 'ci.yml', '--ref', deliveryBranch, '-f', `release_pr=${number}`);
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
