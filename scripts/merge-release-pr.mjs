import { releaseMessages } from './release-messages.mjs';
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const run = (command, ...args) => execFileSync(command, args, { stdio: 'inherit' });
const read = (command, ...args) => execFileSync(command, args, { encoding: 'utf8' }).trim();
const json = (...args) => JSON.parse(read('gh', ...args));

const repository = process.env.GITHUB_REPOSITORY;
const number = process.env.RELEASE_PR;
const branch = process.env.RELEASE_HEAD_REF;
const headSha = process.env.RELEASE_HEAD_SHA;
const verifiedBaseSha = process.env.VERIFIED_BASE_SHA;
const appSlug = process.env.RELEASE_APP_SLUG;
const pullUrl =
  /^[\w.-]+\/[\w.-]+$/.test(repository ?? '') && /^\d+$/.test(number ?? '')
    ? `https://github.com/${repository}/pull/${number}`
    : 'unresolved';
let phase = 'validate request';

const reportFailure = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Release merge incomplete\n\n- Phase: ${phase}\n- Pull request: ${pullUrl}\n- Error: ${message}\n`,
    );
};

try {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) throw new Error('Expected GITHUB_REPOSITORY.');
  if (!/^\d+$/.test(number ?? '')) throw new Error('Expected numeric RELEASE_PR.');
  if (!/^(release|hotfix)\/\d+\.\d+\.\d+$/.test(branch ?? ''))
    throw new Error('Expected RELEASE_HEAD_REF to name a release or hotfix branch.');
  if (!/^[0-9a-f]{40}$/i.test(headSha ?? '') || !/^[0-9a-f]{40}$/i.test(verifiedBaseSha ?? ''))
    throw new Error('Expected full release head and verified base SHAs.');
  if (!/^[a-z\d](?:[a-z\d-]{0,98}[a-z\d])?$/i.test(appSlug ?? ''))
    throw new Error('Expected RELEASE_APP_SLUG.');

  const expectedAuthor = `${appSlug}[bot]`;
  const getPull = () => json('api', `repos/${repository}/pulls/${number}`);
  // Bind the PR to the App-created, same-repository head and exact merge candidate tested by CI.
  const validate = (pull) => {
    if (
      pull.number !== Number(number) ||
      pull.user?.login !== expectedAuthor ||
      pull.head?.repo?.full_name !== repository ||
      pull.base?.repo?.full_name !== repository ||
      pull.head?.ref !== branch ||
      pull.head?.sha !== headSha ||
      !['main', 'develop'].includes(pull.base?.ref)
    ) {
      throw new Error(
        `Pull request does not match the verified release delivery from ${expectedAuthor}.`,
      );
    }
    return pull.base.ref;
  };
  const dispatch = (base) => {
    // GITHUB_TOKEN merges do not trigger push workflows, so resume the base explicitly.
    const args = ['workflow', 'run', 'ci.yml', '--ref', base];
    if (base === 'main') args.push('-f', 'resume_release=true');
    run('gh', ...args);
  };

  phase = 'validate pull request';
  let pull = getPull();
  const base = validate(pull);
  if (pull.merged) {
    phase = 'resume delivery';
    dispatch(base);
  } else {
    if (pull.state !== 'open') throw new Error('Expected an open or merged pull request.');

    phase = 'wait for required checks';
    run('gh', 'pr', 'checks', number, '--watch', '--required', '--fail-fast', '--interval', '10');

    phase = 'revalidate pull request';
    pull = getPull();
    if (validate(pull) !== base) throw new Error('Pull request base changed after verification.');
    if (pull.merged) {
      phase = 'resume delivery';
      dispatch(base);
    } else {
      if (pull.state !== 'open') throw new Error('Pull request closed before merge.');
      const currentBaseSha = json('api', `repos/${repository}/git/ref/heads/${base}`).object?.sha;
      if (currentBaseSha !== verifiedBaseSha)
        throw new Error(`${base} changed after verification; refusing to merge.`);

      phase = 'merge pull request';
      const [kind, version] = branch.split('/');
      run(
        'gh',
        'pr',
        'merge',
        number,
        '--merge',
        '--match-head-commit',
        headSha,
        '--subject',
        releaseMessages(version, kind)[base],
        '--body',
        `Merge ${branch} into ${base}.\n\nPull request: ${pullUrl}`,
      );
      pull = getPull();
      if (validate(pull) !== base) throw new Error('Pull request changed during merge.');
      if (!pull.merged) throw new Error('GitHub did not report the pull request as merged.');
      phase = 'resume delivery';
      dispatch(base);
    }
  }
} catch (error) {
  reportFailure(error);
  throw error;
}
