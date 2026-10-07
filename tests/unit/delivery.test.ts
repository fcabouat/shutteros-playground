import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliver, githubRepository, selectRun } from '../../scripts/delivery.mjs';

type Call = { command: string; args: string[]; capture: boolean | undefined };

const repositoryRoot = resolve(import.meta.dirname, '../..');
const remote = 'git@github.com:example/shutteros.git';
const temporaryRepositories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const path of temporaryRepositories.splice(0))
    rmSync(path, { recursive: true, force: true });
});

function command(call: Call) {
  return `${call.command} ${call.args.join(' ')}`;
}

function harness(overrides: Record<string, string | (() => string) | undefined> = {}) {
  const calls: Call[] = [];
  const defaults: Record<string, string> = {
    'git rev-parse --show-toplevel': repositoryRoot,
    'git status --porcelain': '',
    'git branch --show-current': 'feature/delivery-tests',
    'git remote get-url origin': remote,
    'git remote get-url --push origin': remote,
    'gh --version': 'gh version 2',
    'gh auth status --hostname github.com': '',
    'git fetch --prune origin': '',
  };
  const execute = (program: string, args: string[], capture?: boolean) => {
    const call = { command: program, args: [...args], capture };
    calls.push(call);
    const key = command(call);
    const answer = overrides[key] ?? defaults[key];
    if (answer === undefined) throw new Error(`Unexpected command: ${key}`);
    return typeof answer === 'function' ? answer() : answer;
  };
  return { calls, execute };
}

function mutations(calls: Call[]) {
  return calls
    .map(command)
    .filter(
      (line) =>
        !line.includes(' --dry-run ') &&
        /^(?:git push|git flow release (?:start|finish)|gh pr create|pnpm (?:verify|gitflow:init))\b/.test(
          line,
        ),
    );
}

function finishedReleaseFixture({ published = false } = {}) {
  const parent = mkdtempSync(join(tmpdir(), 'shutteros-delivery-'));
  temporaryRepositories.push(parent);
  const root = join(parent, 'work');
  const upstream = join(parent, 'upstream.git');
  mkdirSync(root);
  execFileSync('git', ['init', '--bare', '-q', upstream]);
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Delivery Test');
  git('config', 'user.email', 'delivery@example.invalid');
  git('remote', 'add', 'origin', upstream);
  mkdirSync(join(root, 'packages/core'), { recursive: true });
  mkdirSync(join(root, 'packages/components'), { recursive: true });
  const writeVersions = (version: string) => {
    for (const file of [
      'package.json',
      'packages/core/package.json',
      'packages/components/package.json',
    ])
      writeFileSync(join(root, file), `${JSON.stringify({ name: file, version })}\n`);
  };
  writeVersions('1.0.0');
  git('add', '.');
  git('commit', '-q', '-m', 'initial');
  git('branch', 'develop');
  git('push', '-q', 'origin', 'main', 'develop');
  git('switch', '-q', 'develop');
  git('switch', '-q', '-c', 'release/1.0.1');
  writeVersions('1.0.1');
  git('add', '.');
  git('commit', '-q', '-m', 'prepare 1.0.1');
  git('switch', '-q', 'main');
  git('merge', '-q', '--no-ff', '-m', 'finish 1.0.1 on main', 'release/1.0.1');
  const sha = git('rev-parse', 'HEAD');
  git('tag', '-a', 'v1.0.1', '-m', 'v1.0.1');
  git('switch', '-q', 'develop');
  git('merge', '-q', '--no-ff', '-m', 'finish 1.0.1 on develop', 'release/1.0.1');
  git('branch', '-d', 'release/1.0.1');
  if (published) git('push', '-q', '--atomic', 'origin', 'main', 'develop', 'v1.0.1');
  git('fetch', '-q', 'origin');
  return { git, root, sha, upstream };
}

function releaseExecutor(
  root: string,
  { completeAssets = true }: { completeAssets?: boolean } = {},
) {
  const calls: Call[] = [];
  const ciRefs: string[] = [];
  const execute = (program: string, args: string[], capture?: boolean) => {
    const call = { command: program, args: [...args], capture };
    calls.push(call);
    if (program === 'pnpm') return '';
    if (program === 'gh') {
      if (args[0] === '--version' || args[0] === 'auth') return '';
      if (args[0] === 'run' && args[1] === 'list') {
        const branch = args[args.indexOf('--branch') + 1]!;
        const sha = args[args.indexOf('--commit') + 1]!;
        ciRefs.push(branch);
        return JSON.stringify([
          {
            databaseId: branch === 'main' ? 202 : 101,
            headBranch: branch,
            headSha: sha,
            event: 'push',
            status: 'completed',
            conclusion: 'success',
            url: `https://github.invalid/actions/${branch}`,
          },
        ]);
      }
      if (args[0] === 'release' && args[1] === 'view')
        return JSON.stringify({
          url: 'https://github.invalid/releases/v1.0.1',
          assets: completeAssets
            ? [{ name: 'shutteros-portable-v1.0.1.html' }, { name: 'shutteros-kiosk-v1.0.1.zip' }]
            : [{ name: 'shutteros-portable-v1.0.1.html' }],
          isDraft: false,
        });
      if (args[0] === 'run' && args[1] === 'view')
        return JSON.stringify({ jobs: [{ name: 'deploy', conclusion: 'success' }] });
      throw new Error(`Unexpected gh command: ${args.join(' ')}`);
    }
    if (program !== 'git') throw new Error(`Unexpected command: ${program} ${args.join(' ')}`);
    if (
      args[0] === 'remote' &&
      args[1] === 'get-url' &&
      (args[2] === 'origin' || (args[2] === '--push' && args[3] === 'origin'))
    )
      return remote;
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  };
  return { calls, ciRefs, execute };
}

describe('delivery helpers', () => {
  it('normalizes supported GitHub remotes and rejects credential-bearing URLs', () => {
    expect(githubRepository('https://github.com/example/project.git')).toBe('example/project');
    expect(githubRepository('git@github.com:example/project.git')).toBe('example/project');
    expect(githubRepository('ssh://git@github.com/example/project')).toBe('example/project');
    expect(() => githubRepository('https://token@github.com/example/project.git')).toThrow(
      /GitHub HTTPS or SSH repository/,
    );
  });

  it.each(['v1.2.3', 'main'])('selects the newest push run for the exact %s commit', (branch) => {
    const sha = `${branch}-sha`;
    const selected = selectRun(
      [
        { databaseId: 45, headBranch: branch, headSha: 'other', event: 'push' },
        { databaseId: 44, headBranch: branch, headSha: sha, event: 'pull_request' },
        { databaseId: 41, headBranch: branch, headSha: sha, event: 'push' },
        { databaseId: 43, headBranch: branch, headSha: sha, event: 'push' },
        { databaseId: 99, headBranch: 'develop', headSha: sha, event: 'push' },
      ],
      branch,
      sha,
    );
    expect(selected?.databaseId).toBe(43);
  });
});

describe('delivery orchestration', () => {
  it('reuses an open pull request after verification and push', async () => {
    const { calls, execute } = harness({
      'git rev-parse --verify HEAD': 'head-sha',
      'git rev-list --count origin/develop..HEAD': '2',
      'git log -1 --format=%s': 'Deliver safely',
      'git log --reverse --format=- %s origin/develop..HEAD': '- first\n- second',
      'git push --dry-run origin HEAD:refs/heads/feature/delivery-tests': '',
      'pnpm verify': '',
      'git push -u origin HEAD:refs/heads/feature/delivery-tests': '',
      'gh pr list --repo example/shutteros --base develop --head feature/delivery-tests --state open --json url,headRepositoryOwner,headRepository':
        JSON.stringify([
          {
            url: 'https://github.com/fork-owner/shutteros/pull/99',
            headRepositoryOwner: { login: 'fork-owner' },
            headRepository: { name: 'shutteros' },
          },
          {
            url: 'https://github.com/example/shutteros/pull/17',
            headRepositoryOwner: { login: 'example' },
            headRepository: { name: 'shutteros' },
          },
        ]),
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await deliver(['pr'], { cwd: repositoryRoot, execute, delay: async () => undefined });

    expect(log).toHaveBeenCalledWith('https://github.com/example/shutteros/pull/17');
    expect(calls.map(command)).toContain('pnpm verify');
    expect(calls.map(command)).toContain(
      'git push -u origin HEAD:refs/heads/feature/delivery-tests',
    );
    expect(calls.map(command)).not.toContain(expect.stringMatching(/^gh pr create/));
    log.mockRestore();
  });

  it('recovers an uncertain PR create by finding the request created remotely', async () => {
    let lists = 0;
    const { calls, execute } = harness({
      'git rev-parse --verify HEAD': 'head-sha',
      'git rev-list --count origin/develop..HEAD': '1',
      'git log -1 --format=%s': 'Deliver safely',
      'git log --reverse --format=- %s origin/develop..HEAD': '- change',
      'git push --dry-run origin HEAD:refs/heads/feature/delivery-tests': '',
      'pnpm verify': '',
      'git push -u origin HEAD:refs/heads/feature/delivery-tests': '',
      'gh pr list --repo example/shutteros --base develop --head feature/delivery-tests --state open --json url,headRepositoryOwner,headRepository':
        () =>
          ++lists === 1
            ? '[]'
            : JSON.stringify([
                {
                  url: 'https://github.com/example/shutteros/pull/18',
                  headRepositoryOwner: { login: 'example' },
                  headRepository: { name: 'shutteros' },
                },
              ]),
      'gh pr create --repo example/shutteros --base develop --head feature/delivery-tests --title Deliver safely --body Changes:\n- change\n\nValidation: pnpm verify.':
        () => {
          throw new Error('connection closed after request');
        },
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await deliver(['pr'], { cwd: repositoryRoot, execute, delay: async () => undefined });

    expect(lists).toBe(2);
    expect(calls.map(command).filter((line) => line.startsWith('gh pr create'))).toHaveLength(1);
    expect(log).toHaveBeenCalledWith('https://github.com/example/shutteros/pull/18');
    log.mockRestore();
  });

  it.each([
    {
      name: 'a dirty tree',
      overrides: { 'git status --porcelain': ' M package.json' },
      message: /Commit or stash/,
    },
    {
      name: 'a detached HEAD',
      overrides: { 'git branch --show-current': '' },
      message: /Detached HEAD/,
    },
  ])('fails before mutation for $name', async ({ overrides, message }) => {
    const { calls, execute } = harness(overrides);

    await expect(deliver(['pr'], { cwd: repositoryRoot, execute })).rejects.toThrow(message);

    expect(mutations(calls)).toEqual([]);
  });

  it('refuses an unsynchronized release before initializing or starting Gitflow', async () => {
    const { calls, execute } = harness({
      'git branch --show-current': 'develop',
      'git ls-remote origin refs/tags/v1.0.1': '',
      'git for-each-ref --format=%(objectname) refs/tags/v1.0.1': '',
      'git for-each-ref --format=%(objectname) refs/heads/release/1.0.1': '',
      'git rev-parse --verify refs/heads/main': 'local-main',
      'git rev-parse --verify refs/remotes/origin/main': 'remote-main',
    });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(deliver(['release', 'patch'], { cwd: repositoryRoot, execute })).rejects.toThrow(
      /main must exactly match origin\/main/,
    );

    expect(mutations(calls)).toEqual([]);
    vi.restoreAllMocks();
  });

  it('does not start a release when the exact develop push failed CI', async () => {
    const develop = 'develop-sha';
    const { calls, execute } = harness({
      'git branch --show-current': 'develop',
      'git ls-remote origin refs/tags/v1.0.1': '',
      'git for-each-ref --format=%(objectname) refs/tags/v1.0.1': '',
      'git for-each-ref --format=%(objectname) refs/heads/release/1.0.1': '',
      'git rev-parse --verify refs/heads/main': 'main-sha',
      'git rev-parse --verify refs/remotes/origin/main': 'main-sha',
      'git rev-parse --verify refs/heads/develop': develop,
      'git rev-parse --verify refs/remotes/origin/develop': develop,
      'git rev-parse --verify develop': develop,
      'git for-each-ref --format=%(refname) refs/heads/release/ refs/remotes/origin/release/': '',
      'git push --dry-run --atomic origin refs/heads/main refs/heads/develop': '',
      'pnpm gitflow:init': '',
      [`gh run list --repo example/shutteros --workflow ci.yml --branch develop --commit ${develop} --event push --limit 30 --json databaseId,headBranch,headSha,event,status,conclusion,url`]:
        JSON.stringify([
          {
            databaseId: 22,
            headBranch: 'develop',
            headSha: develop,
            event: 'push',
            status: 'completed',
            conclusion: 'failure',
            url: 'https://github.com/example/shutteros/actions/runs/22',
          },
        ]),
    });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(
      deliver(['release', 'patch'], { cwd: repositoryRoot, execute, delay: async () => undefined }),
    ).rejects.toThrow(/CI failure/);

    expect(calls.map(command)).toContain('pnpm gitflow:init');
    expect(calls.map(command)).not.toContain('git flow release start 1.0.1');
    expect(mutations(calls)).toEqual(['pnpm gitflow:init']);
    vi.restoreAllMocks();
  });

  it('validates and atomically publishes a finished release, then resumes without repushing', async () => {
    const { root, sha, git } = finishedReleaseFixture();
    const { calls, ciRefs, execute } = releaseExecutor(root);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await deliver(['release', '1.0.1', '--resume'], {
      cwd: root,
      execute,
      delay: async () => undefined,
    });

    const atomicPush =
      'git push --atomic origin refs/heads/main refs/heads/develop refs/tags/v1.0.1';
    expect(calls.map(command).filter((line) => line === atomicPush)).toHaveLength(1);
    expect(git('ls-remote', 'origin', 'refs/tags/v1.0.1')).toContain(
      git('rev-parse', 'refs/tags/v1.0.1'),
    );
    expect(ciRefs).toEqual(['v1.0.1', 'main']);

    await deliver(['release', '1.0.1', '--resume'], {
      cwd: root,
      execute,
      delay: async () => undefined,
    });

    expect(calls.map(command).filter((line) => line === atomicPush)).toHaveLength(1);
    expect(ciRefs).toEqual(['v1.0.1', 'main', 'v1.0.1', 'main']);
    expect(git('rev-parse', 'refs/tags/v1.0.1^{}')).toBe(sha);
  });

  it('stops after tag CI when the release assets are incomplete', async () => {
    const { root } = finishedReleaseFixture();
    const { calls, ciRefs, execute } = releaseExecutor(root, { completeAssets: false });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(
      deliver(['release', '1.0.1', '--resume'], {
        cwd: root,
        execute,
        delay: async () => undefined,
      }),
    ).rejects.toThrow(/Release assets are incomplete/);

    expect(calls.map(command)).toContain(
      'git push --atomic origin refs/heads/main refs/heads/develop refs/tags/v1.0.1',
    );
    expect(ciRefs).toEqual(['v1.0.1']);
    expect(calls.map(command)).not.toContain(expect.stringMatching(/^gh run view/));
  });

  it('refuses a local tag that differs from the immutable published tag', async () => {
    const { root, git } = finishedReleaseFixture({ published: true });
    git('tag', '-d', 'v1.0.1');
    git('tag', '-a', 'v1.0.1', '-m', 'different local tag object', 'main');
    const { calls, ciRefs, execute } = releaseExecutor(root);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(
      deliver(['release', '1.0.1', '--resume'], {
        cwd: root,
        execute,
        delay: async () => undefined,
      }),
    ).rejects.toThrow(/differs locally and remotely/);

    expect(calls.map(command)).not.toContain(
      'git push --atomic origin refs/heads/main refs/heads/develop refs/tags/v1.0.1',
    );
    expect(ciRefs).toEqual([]);
  });
});
