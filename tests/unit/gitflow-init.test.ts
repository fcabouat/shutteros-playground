import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const sourceRoot = resolve(import.meta.dirname, '../..');

describe('gitflow initializer', () => {
  let root: string;
  let environment: NodeJS.ProcessEnv;

  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const initialize = () =>
    spawnSync('sh', ['scripts/gitflow-init.sh'], {
      cwd: root,
      encoding: 'utf8',
      env: environment,
    });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'shutteros-gitflow-init-'));
    mkdirSync(join(root, 'scripts'), { recursive: true });
    mkdirSync(join(root, 'bin'), { recursive: true });
    cpSync(join(sourceRoot, 'scripts/gitflow-init.sh'), join(root, 'scripts/gitflow-init.sh'));
    cpSync(join(sourceRoot, '.gitflow'), join(root, '.gitflow'), { recursive: true });
    const fakeGitflow = join(root, 'bin/git-flow');
    writeFileSync(
      fakeGitflow,
      '#!/bin/sh\n[ "${1:-}" = version ] && echo "1.12.3 (AVH Edition)"\nexit 0\n',
    );
    chmodSync(fakeGitflow, 0o755);
    environment = { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}` };
    git('init', '-b', 'main');
    git('config', 'user.name', 'Gitflow Test');
    git('config', 'user.email', 'gitflow@example.invalid');
    git('add', '.');
    git('commit', '-m', 'initial');
    git('branch', 'develop');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('links the tracked hooks and remains idempotent', () => {
    expect(initialize().status).toBe(0);
    const hook = join(root, '.git/hooks/filter-flow-release-start-version');
    expect(lstatSync(hook).isSymbolicLink()).toBe(true);
    expect(initialize().status).toBe(0);
    expect(lstatSync(hook).isSymbolicLink()).toBe(true);
  });

  it('overrides inherited preferences that would change the finish graph or push it partially', () => {
    const globalConfig = join(root, 'global.gitconfig');
    const options = [
      'ff-master',
      'nodevelopmerge',
      'pushproduction',
      'pushdevelop',
      'pushtag',
      'push',
      'squash',
      'notag',
    ];
    writeFileSync(
      globalConfig,
      '[gitflow "release.finish"]\n' +
        options.map((option) => `\t${option} = true\n`).join('') +
        '[gitflow "hotfix.finish"]\n\tpush = true\n\tsquash = true\n\tnotag = true\n',
    );
    environment = { ...environment, GIT_CONFIG_GLOBAL: globalConfig };
    expect(git('config', '--bool', 'gitflow.release.finish.ff-master')).toBe('true');
    expect(initialize().status).toBe(0);
    for (const option of options)
      expect(git('config', '--local', '--bool', `gitflow.release.finish.${option}`)).toBe('false');
    for (const option of ['push', 'squash', 'notag'])
      expect(git('config', '--local', '--bool', `gitflow.hotfix.finish.${option}`)).toBe('false');
    expect(readFileSync(globalConfig, 'utf8')).toContain('ff-master = true');
  });

  it('refuses a conflicting hook without replacing it or partially installing links', () => {
    const hooks = join(root, '.git/hooks');
    mkdirSync(hooks, { recursive: true });
    const conflict = join(hooks, 'filter-flow-hotfix-finish-tag-message');
    const laterHook = join(hooks, 'post-flow-release-finish');
    writeFileSync(conflict, '#!/bin/sh\nexit 17\n');
    if (existsSync(laterHook)) unlinkSync(laterHook);

    const result = initialize();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('refusing to replace existing hook');
    expect(readFileSync(conflict, 'utf8')).toBe('#!/bin/sh\nexit 17\n');
    expect(existsSync(laterHook)).toBe(false);
    expect(
      spawnSync('git', ['config', '--get', 'gitflow.branch.master'], {
        cwd: root,
        encoding: 'utf8',
      }).status,
    ).not.toBe(0);
  });
});
