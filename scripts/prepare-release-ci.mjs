import { releaseMessages } from './release-messages.mjs';
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReleasePull, releaseAppIdentity } from './create-release-pr.mjs';

const run = (command, ...args) => execFileSync(command, args, { stdio: 'inherit' });
const read = (command, ...args) => execFileSync(command, args, { encoding: 'utf8' }).trim();
const json = (...args) => JSON.parse(read('gh', ...args));
const summary = [];
const temporary = mkdtempSync(join(tmpdir(), 'shutteros-ci-release-'));
try {
  const { author: releaseAuthor } = releaseAppIdentity();
  if (read('git', 'status', '--porcelain')) throw new Error('Release checkout must be clean.');
  run('git', 'fetch', 'origin', '--tags');
  const verified = process.env.GITHUB_SHA;
  if (!verified) throw new Error('Expected the commit verified by CI.');
  if (read('git', 'rev-parse', 'origin/develop') !== verified)
    throw new Error(
      'Develop advanced after this request. Run pnpm release again to verify its current head.',
    );
  if (read('git', 'rev-parse', 'HEAD') !== verified)
    throw new Error('Checkout differs from the verified commit.');
  const open = json(
    'pr',
    'list',
    '--state',
    'open',
    '--limit',
    '100',
    '--json',
    'number,url,headRefName,headRefOid,baseRefName,isCrossRepository,author',
  );
  const delivery = open.find(
    (pr) =>
      !pr.isCrossRepository &&
      pr.baseRefName === 'main' &&
      /^(release|hotfix)\//.test(pr.headRefName),
  );
  const returning = open.find(
    (pr) =>
      !pr.isCrossRepository &&
      pr.baseRefName === 'develop' &&
      (/^(release|hotfix)\//.test(pr.headRefName) || pr.headRefName === 'main'),
  );
  const existingPull = delivery ?? returning;
  if (existingPull) {
    if (existingPull.headRefName === 'main')
      throw new Error(`Finish the previous main-to-develop return first: ${existingPull.url}`);
    if (existingPull.author?.login === releaseAuthor)
      summary.push(`- Existing release pull request is awaiting its checks: ${existingPull.url}`);
    else
      summary.push(`- Existing legacy pull request requires manual recovery: ${existingPull.url}`);
  } else {
    // SHA checkouts have no local develop ref, but Changesets resolves that
    // configured base even inside its disposable worktree. Attach it before planning.
    run('git', 'switch', 'develop');
    if (read('git', 'rev-parse', 'HEAD') !== verified)
      throw new Error('Local develop differs from the verified commit.');
    const report = join(temporary, 'plan.json');
    run(process.execPath, fileURLToPath(new URL('./release.mjs', import.meta.url)), 'plan', report);
    const plan = JSON.parse(readFileSync(report, 'utf8'));
    const next = plan.releases.find((item) => item.name === 'shutteros-playground')?.newVersion;
    if (!next) {
      summary.push('- No pending Changeset: no release created.');
    } else {
      if (!/^\d+\.\d+\.\d+$/.test(next)) throw new Error('Expected a stable Changesets version.');
      const branch = `release/${next}`;
      if (read('git', 'tag', '--list', `v${next}`)) {
        throw new Error(
          `v${next} is already tagged. Integrate its release branch before preparing another version.`,
        );
      }
      const existing = read('git', 'branch', '-r', '--list', `origin/${branch}`);
      if (existing) {
        // Recover a push that succeeded before PR creation. A different baseline
        // needs review rather than silently replacing an existing delivery.
        const pkg = JSON.parse(read('git', 'show', `origin/${branch}:package.json`));
        if (pkg.version !== next || read('git', 'rev-parse', `origin/${branch}^`) !== verified) {
          throw new Error(
            `${branch} already exists from another baseline. Inspect that existing delivery before retrying.`,
          );
        }
      } else {
        run('git', 'config', 'user.name', 'github-actions[bot]');
        run('git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
        run(process.execPath, fileURLToPath(new URL('./release.mjs', import.meta.url)), 'prepare');
        run('git', 'push', '--set-upstream', 'origin', branch);
      }
      const url = createReleasePull({
        head: branch,
        base: 'main',
        title: releaseMessages(next).main,
        body: 'Requested from develop. Automation verifies this merge, waits for required checks, then merges and publishes the Changesets version. The release branch is subsequently merged back into develop.',
      });
      summary.push(`- Release queued for verification and merge: ${url}`);
    }
  }
} catch (error) {
  summary.push(
    '- Preparation incomplete. Retry on develop; existing branches and tags are preserved.',
  );
  throw error;
} finally {
  rmSync(temporary, { recursive: true, force: true });
  console.log(summary.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Release preparation\n\n${summary.join('\n')}\n`,
    );
}
