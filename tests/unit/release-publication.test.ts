import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const publishScript = resolve(import.meta.dirname, '../../scripts/publish-release.sh');

describe('GitHub release publication', () => {
  let root: string;
  let log: string;
  let environment: NodeJS.ProcessEnv;
  const assets = ['shutteros-portable-v0.2.0.html', 'shutteros-kiosk-v0.2.0.zip'];

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'shutteros-publish-release-'));
    log = join(root, 'gh.log');
    mkdirSync(join(root, 'bin'));
    for (const asset of assets) writeFileSync(join(root, asset), asset);
    const mockGh = join(root, 'bin/gh');
    writeFileSync(
      mockGh,
      `#!/bin/sh
printf '%s\n' "$*" >> "$MOCK_GH_LOG"
case "$MOCK_SCENARIO" in
  new)
    if [ "$1" = api ]; then
      echo 'gh: Not Found (HTTP 404)' >&2
      exit 1
    fi
    ;;
  full)
    if [ "$1" = api ]; then
      printf '%s\n' '${assets[0]}' '${assets[1]}'
      exit 0
    fi
    ;;
  partial|upload-failure)
    if [ "$1" = api ]; then
      printf '%s\n' '${assets[0]}'
      exit 0
    fi
    [ "$MOCK_SCENARIO" = 'upload-failure' ] && [ "$1 $2" = 'release upload' ] && exit 5
    ;;
  api-failure)
    if [ "$1" = api ]; then
      echo 'gh: Resource not accessible (HTTP 403)' >&2
      exit 4
    fi
    ;;
esac
exit 0
`,
    );
    chmodSync(mockGh, 0o755);
    spawnSync('git', ['init', '-q'], { cwd: root });
    spawnSync('git', ['config', 'user.name', 'Release Test'], { cwd: root });
    spawnSync('git', ['config', 'user.email', 'release@example.invalid'], { cwd: root });
    writeFileSync(join(root, 'history.txt'), 'initial\n');
    spawnSync('git', ['add', 'history.txt'], { cwd: root });
    spawnSync('git', ['commit', '-q', '-m', 'initial'], { cwd: root });
    spawnSync('git', ['tag', '-a', 'v0.1.0', '-m', 'previous'], { cwd: root });
    writeFileSync(join(root, 'history.txt'), 'release\n');
    spawnSync('git', ['commit', '-q', '-am', 'release'], { cwd: root });
    spawnSync('git', ['tag', '-a', 'v0.2.0', '-m', 'current'], { cwd: root });
    writeFileSync(join(root, 'history.txt'), 'future\n');
    spawnSync('git', ['commit', '-q', '-am', 'future'], { cwd: root });
    spawnSync('git', ['tag', '-a', 'v9.0.0', '-m', 'future'], { cwd: root });
    environment = {
      ...process.env,
      PATH: `${join(root, 'bin')}:${process.env.PATH}`,
      MOCK_GH_LOG: log,
      GH_REPO: 'example/shutteros',
    };
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const publish = (scenario: string) =>
    spawnSync('sh', [publishScript, 'v0.2.0', ...assets], {
      cwd: root,
      encoding: 'utf8',
      env: { ...environment, MOCK_SCENARIO: scenario },
    });
  const commands = () => readFileSync(log, 'utf8');

  it('creates a new release and uploads every asset', () => {
    expect(publish('new').status).toBe(0);
    expect(commands()).toContain('release create v0.2.0 --verify-tag');
    expect(commands()).toContain('--notes-start-tag v0.1.0');
    expect(commands()).not.toContain('--notes-start-tag v9.0.0');
    for (const asset of assets) expect(commands()).toContain(`release upload v0.2.0 ${asset}`);
  });

  it('leaves an existing complete release untouched', () => {
    expect(publish('full').status).toBe(0);
    expect(commands()).not.toContain('release create');
    expect(commands()).not.toContain('release upload');
  });

  it('uploads only the missing asset of a partial release', () => {
    expect(publish('partial').status).toBe(0);
    expect(commands()).not.toContain(`release upload v0.2.0 ${assets[0]}`);
    expect(commands()).toContain(`release upload v0.2.0 ${assets[1]}`);
  });

  it('fails closed on API and upload errors', () => {
    expect(publish('api-failure').status).not.toBe(0);
    expect(commands()).not.toContain('release create');
    expect(commands()).not.toContain('release upload');
    writeFileSync(log, '');
    expect(publish('upload-failure').status).not.toBe(0);
  });
});
