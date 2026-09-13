import { execFileSync } from 'node:child_process';

const run = (command, ...args) => execFileSync(command, args, { stdio: 'inherit' });
const read = (command, ...args) => execFileSync(command, args, { encoding: 'utf8' }).trim();
const json = (...args) => JSON.parse(read('gh', ...args));

const repository = process.env.GITHUB_REPOSITORY;
const number = process.env.RELEASE_PR;
const branch = process.env.GITHUB_REF_NAME;
const headSha = process.env.GITHUB_SHA;
const verifiedBaseSha = process.env.VERIFIED_BASE_SHA;
if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) throw new Error('Expected GITHUB_REPOSITORY.');
if (!/^\d+$/.test(number ?? '')) throw new Error('Expected numeric RELEASE_PR.');
if (!/^(release|hotfix)\/\d+\.\d+\.\d+$/.test(branch ?? ''))
  throw new Error('Expected a release or hotfix branch.');
if (!/^[0-9a-f]{40}$/i.test(headSha ?? '') || !/^[0-9a-f]{40}$/i.test(verifiedBaseSha ?? ''))
  throw new Error('Expected full delivery and verified base SHAs.');

const getPull = () => json('api', `repos/${repository}/pulls/${number}`);
// Bind the GitHub PR to the exact head and base whose synthetic merge commit CI tested.
const validate = (pull) => {
  if (
    pull.number !== Number(number) ||
    pull.head?.repo?.full_name !== repository ||
    pull.base?.repo?.full_name !== repository ||
    pull.head?.ref !== branch ||
    pull.head?.sha !== headSha ||
    !['main', 'develop'].includes(pull.base?.ref)
  ) {
    throw new Error('Pull request does not match the verified release delivery.');
  }
  return pull.base.ref;
};
const dispatch = (base) => {
  // GITHUB_TOKEN merges do not trigger push workflows, so resume the base explicitly.
  const args = ['workflow', 'run', 'ci.yml', '--ref', base];
  if (base === 'main') args.push('-f', 'resume_release=true');
  run('gh', ...args);
};

let pull = getPull();
const base = validate(pull);
if (pull.merged) {
  dispatch(base);
  process.exit(0);
}
if (pull.state !== 'open') throw new Error('Expected an open or merged pull request.');

run('gh', 'pr', 'checks', number, '--watch', '--required', '--fail-fast', '--interval', '10');

pull = getPull();
if (validate(pull) !== base) throw new Error('Pull request base changed after verification.');
if (pull.merged) {
  dispatch(base);
  process.exit(0);
}
if (pull.state !== 'open') throw new Error('Pull request closed before merge.');
const currentBaseSha = json('api', `repos/${repository}/git/ref/heads/${base}`).object?.sha;
if (currentBaseSha !== verifiedBaseSha)
  throw new Error(`${base} changed after verification; refusing to merge.`);

run('gh', 'pr', 'merge', number, '--merge', '--match-head-commit', headSha);
pull = getPull();
if (validate(pull) !== base) throw new Error('Pull request base changed during merge.');
if (!pull.merged) throw new Error('GitHub did not report the pull request as merged.');
dispatch(base);
