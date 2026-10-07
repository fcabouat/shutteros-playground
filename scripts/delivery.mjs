// Small CLI adapter: AVH owns Gitflow, version.mjs owns versions, CI owns publication.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { isVersion, nextVersion, readVersion, readVersions, validateTag } from './version.mjs';

/** @param {string} remote */
export function githubRepository(remote) {
  const match =
    /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(
      remote,
    );
  if (!match?.[1])
    throw new Error(
      'origin must be a GitHub HTTPS or SSH repository (without credentials in the URL).',
    );
  return match[1];
}

/**
 * @typedef {{databaseId: number, headBranch: string, headSha: string, event: string, status?: string, conclusion?: string, url?: string}} WorkflowRun
 * @param {WorkflowRun[]} runs
 * @param {string} branch
 * @param {string} sha
 */
export function selectRun(runs, branch, sha) {
  return runs
    .filter((run) => run.headBranch === branch && run.headSha === sha && run.event === 'push')
    .sort((a, b) => b.databaseId - a.databaseId)[0];
}

/**
 * @typedef {(command: string, args: string[], capture?: boolean) => string} Execute
 * @param {string[]} argv
 * @param {{cwd?: string, execute?: Execute, delay?: (milliseconds: number) => Promise<void>}} [options]
 */
export async function deliver(argv, { cwd = process.cwd(), execute, delay = sleep } = {}) {
  /** @type {NodeJS.ProcessEnv} */
  const env = { ...process.env, GIT_MERGE_AUTOEDIT: 'no' };
  // Never inherit a local emergency bypass into the normal release command.
  delete env.SHUTTEROS_SKIP_VERIFY;
  /** @type {Execute} */
  const run =
    execute ??
    ((command, args, capture = true) => {
      const result = spawnSync(command, args, {
        cwd,
        env,
        encoding: 'utf8',
        stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      });
      if (result.error) throw result.error;
      if (result.status !== 0)
        throw new Error(
          `${command} ${args[0]} failed${capture ? `: ${result.stderr?.trim()}` : '.'}`,
        );
      return (result.stdout ?? '').trim();
    });
  /** @param {string[]} args */
  const git = (...args) => run('git', args);
  const root = git('rev-parse', '--show-toplevel');
  cwd = root;
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      resume: { type: 'boolean' },
      title: { type: 'string' },
      'body-file': { type: 'string' },
    },
  });
  const [action, request = ''] = positionals;
  if (
    positionals.length > 2 ||
    (action !== 'pr' && action !== 'release') ||
    (action === 'release' && !request) ||
    (action === 'pr' && request)
  )
    throw new Error(
      'Usage: pnpm pr [--title TEXT] [--body-file PATH] | pnpm release <patch|minor|major|X.Y.Z> [--resume]',
    );
  if (
    (action === 'pr' && values.resume) ||
    (action === 'release' && (values.title || values['body-file']))
  )
    throw new Error('Options do not apply to this command.');
  if (git('status', '--porcelain'))
    throw new Error('Commit or stash your changes first (including untracked files).');
  const branch = git('branch', '--show-current');
  if (!branch) throw new Error('Detached HEAD: switch to a working branch first.');
  const repo = githubRepository(git('remote', 'get-url', 'origin'));
  if (githubRepository(git('remote', 'get-url', '--push', 'origin')) !== repo)
    throw new Error('origin fetch and push must target the same repository.');
  /** @param {string[]} args */
  const gh = (...args) => run('gh', args);
  /** @param {string[]} args */
  const api = (...args) => JSON.parse(gh(...args));
  run('gh', ['--version']);
  let authenticated = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      gh('auth', 'status', '--hostname', 'github.com');
      authenticated = true;
      break;
    } catch {
      if (!process.stdin.isTTY)
        throw new Error('Run gh auth login --hostname github.com, then retry.');
      console.log('Sign in with GitHub CLI; credentials remain managed by gh.');
      try {
        run('gh', ['auth', 'login', '--hostname', 'github.com', '--web'], false);
      } catch {
        /* Allow retry. */
      }
    }
  }
  if (!authenticated) {
    gh('auth', 'status', '--hostname', 'github.com');
  }
  const fetch = () => run('git', ['fetch', '--prune', 'origin'], false);
  /** @param {string} ref */
  const oid = (ref) => git('rev-parse', '--verify', ref);
  /** @param {string} ref */
  const exists = (ref) => Boolean(git('for-each-ref', '--format=%(objectname)', ref));
  const clean = () => {
    if (git('status', '--porcelain'))
      throw new Error(
        'Verification changed tracked files; inspect and commit them before retrying.',
      );
  };
  fetch();
  if (action === 'pr') {
    if (!/^(feature|bugfix)\/.+/.test(branch))
      throw new Error('pnpm pr expects a feature/* or bugfix/* branch.');
    const head = oid('HEAD');
    if (git('rev-list', '--count', 'origin/develop..HEAD') === '0')
      throw new Error('No commits to propose to develop.');
    const title = values.title ?? git('log', '-1', '--format=%s');
    const body = values['body-file']
      ? readFileSync(resolve(root, values['body-file']), 'utf8')
      : `Changes:\n${git('log', '--reverse', '--format=- %s', 'origin/develop..HEAD')}\n\nValidation: pnpm verify.`;
    run('git', ['push', '--dry-run', 'origin', `HEAD:refs/heads/${branch}`], false);
    run('pnpm', ['verify'], false);
    clean();
    if (oid('HEAD') !== head) throw new Error('HEAD changed during verification.');
    run('git', ['push', '-u', 'origin', `HEAD:refs/heads/${branch}`], false);
    const find = () =>
      api(
        'pr',
        'list',
        '--repo',
        repo,
        '--base',
        'develop',
        '--head',
        branch,
        '--state',
        'open',
        '--json',
        'url,headRepositoryOwner,headRepository',
      ).filter(
        /** @param {{headRepositoryOwner?: {login: string}, headRepository?: {name: string}}} pr */
        (pr) =>
          pr.headRepositoryOwner?.login === repo.split('/')[0] &&
          pr.headRepository?.name === repo.split('/')[1],
      );
    const existing = find();
    if (existing.length) {
      console.log(existing[0].url);
      return;
    }
    try {
      console.log(
        gh(
          'pr',
          'create',
          '--repo',
          repo,
          '--base',
          'develop',
          '--head',
          branch,
          '--title',
          title,
          '--body',
          body,
        ),
      );
    } catch (error) {
      const created = find();
      if (!created.length) throw error;
      console.log(created[0].url);
    }
    return;
  }

  /** @param {string} ref @param {string} sha */
  const waitCI = async (ref, sha) => {
    console.log(`Waiting for CI: ${ref} (${sha.slice(0, 8)})`);
    // Bound discovery and execution; interruption never cancels the remote workflow.
    for (let attempt = 0; attempt < 240; attempt++) {
      const runs = api(
        'run',
        'list',
        '--repo',
        repo,
        '--workflow',
        'ci.yml',
        '--branch',
        ref,
        '--commit',
        sha,
        '--event',
        'push',
        '--limit',
        '30',
        '--json',
        'databaseId,headBranch,headSha,event,status,conclusion,url',
      );
      const current = selectRun(runs, ref, sha);
      if (current?.status === 'completed') {
        if (current.conclusion !== 'success')
          throw new Error(
            `CI ${current.conclusion}: ${current.url}. Rerun only transient failures. Tagged code fixes require a new patch release. Retry using the command printed above.`,
          );
        console.log(current.url);
        return current;
      }
      if (attempt % 4 === 0)
        console.log(
          current
            ? `CI ${current.status}: ${current.url}`
            : 'Waiting for the push workflow to appear…',
        );
      await delay(15_000);
    }
    throw new Error(
      `Timed out waiting for CI on ${ref}; inspect GitHub Actions and retry using the command printed above.`,
    );
  };
  const synchronized = () => {
    for (const name of ['main', 'develop'])
      if (oid(`refs/heads/${name}`) !== oid(`refs/remotes/origin/${name}`))
        throw new Error(
          `${name} must exactly match origin/${name}. Synchronize it explicitly first.`,
        );
  };
  const version = values.resume
    ? request.replace(/^v/, '')
    : nextVersion(readVersion(root, 'develop'), request);
  if (!isVersion(version)) throw new Error('--resume requires an explicit X.Y.Z version.');
  const tag = `v${version}`;
  const delivery = `release/${version}`;
  console.log(
    `Release ${tag}. ${values.resume ? 'Resuming existing delivery.' : `Before preparation, retry with: pnpm release ${version}`}`,
  );
  const remoteTag = () => git('ls-remote', 'origin', `refs/tags/${tag}`).split(/\s/)[0];
  const published = remoteTag();
  if (published && values.resume && !exists(`refs/tags/${tag}`))
    run('git', ['fetch', 'origin', `refs/tags/${tag}:refs/tags/${tag}`], false);
  if (
    !values.resume &&
    (published || exists(`refs/tags/${tag}`) || exists(`refs/heads/${delivery}`))
  )
    throw new Error(
      `${tag} or ${delivery} already exists; inspect it and use --resume if appropriate.`,
    );
  if (!values.resume) {
    if (branch !== 'develop') throw new Error('Start a release from develop.');
    synchronized();
    const ensureAvailable = () => {
      if (
        remoteTag() ||
        exists(`refs/tags/${tag}`) ||
        git(
          'for-each-ref',
          '--format=%(refname)',
          'refs/heads/release/',
          'refs/remotes/origin/release/',
        )
      )
        throw new Error(
          'A release branch or target tag already exists; reconcile it before starting.',
        );
    };
    const current = readVersion(root, 'develop').split('.').map(Number);
    const target = version.split('.').map(Number);
    const differing = target.findIndex((part, index) => part !== current[index]);
    if (differing < 0 || (target[differing] ?? 0) < (current[differing] ?? 0))
      throw new Error('The release version must be greater than develop’s version.');
    ensureAvailable();
    run(
      'git',
      ['push', '--dry-run', '--atomic', 'origin', 'refs/heads/main', 'refs/heads/develop'],
      false,
    );
    const base = oid('develop');
    run('pnpm', ['gitflow:init'], false);
    await waitCI('develop', base);
    fetch();
    synchronized();
    if (oid('develop') !== base) throw new Error('develop changed while waiting for CI.');
    ensureAvailable();
    clean();
    run('git', ['flow', 'release', 'start', version], false);
  }
  console.log(`If interrupted, use: pnpm release ${version} --resume`);
  if (!exists(`refs/tags/${tag}`)) {
    // A partially completed AVH finish must be inspected, not replayed blindly.
    synchronized();
    if (
      git('branch', '--show-current') !== delivery ||
      readVersions(root).some((candidate) => candidate !== version)
    )
      throw new Error(
        `Resume before tagging requires the clean ${delivery} branch with version ${version}.`,
      );
    git('merge-base', '--is-ancestor', 'develop', delivery);
    run('pnpm', ['gitflow:init'], false);
    run('git', ['flow', 'release', 'finish', version], false);
  }
  clean();
  const sha = oid(`refs/tags/${tag}^{}`);
  if (published) {
    if (published !== oid(`refs/tags/${tag}`))
      throw new Error(`${tag} differs locally and remotely; refusing to overwrite it.`);
    validateTag(root, tag, sha);
  } else {
    validateTag(root, tag, sha, { main: 'main', develop: 'develop' });
    if (oid('main') !== sha)
      throw new Error('main moved beyond the release tag; inspect before publishing.');
    fetch();
    for (const name of ['main', 'develop'])
      git('merge-base', '--is-ancestor', `origin/${name}`, name);
    run(
      'git',
      ['push', '--atomic', 'origin', 'refs/heads/main', 'refs/heads/develop', `refs/tags/${tag}`],
      false,
    );
  }
  await waitCI(tag, sha);
  /** @type {{url: string, assets: {name: string}[], isDraft: boolean}} */
  const release = api('release', 'view', tag, '--repo', repo, '--json', 'url,assets,isDraft');
  const names = new Set(release.assets.map((asset) => asset.name));
  if (
    release.isDraft ||
    !names.has(`shutteros-portable-${tag}.html`) ||
    !names.has(`shutteros-kiosk-${tag}.zip`)
  )
    throw new Error(
      `Release assets are incomplete: ${release.url}. Rerun the tag workflow then resume.`,
    );
  console.log(`Published: ${release.url}`);
  const mainRun = await waitCI('main', sha);
  /** @type {{jobs: {name: string, conclusion: string}[]}} */
  const { jobs } = api('run', 'view', String(mainRun.databaseId), '--repo', repo, '--json', 'jobs');
  const deploy = jobs.find((job) => job.name === 'deploy');
  console.log(
    deploy?.conclusion === 'success'
      ? 'Pages deployment completed.'
      : `Pages not deployed by this run (${deploy?.conclusion ?? 'no deploy job'}).`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  deliver(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
