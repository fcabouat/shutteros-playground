import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { buildRoot, projectRoot } from './build-paths.mjs';

if (process.env.CI)
  throw new Error('ISO generation is a local operator command, excluded from CI.');
const { values } = parseArgs({
  options: {
    'base-iso': { type: 'string' },
    cache: { type: 'string' },
    'admin-config': { type: 'string' },
    'skip-build': { type: 'boolean', default: false },
  },
});
const env = { ...process.env };
delete env.SHUTTEROS_PUBLIC_BUILD;
delete env.BASE_PATH;
if (!values['skip-build']) {
  const runner = process.env.npm_config_user_agent?.startsWith('bun/') ? 'bun' : 'pnpm';
  const result = spawnSync(runner, ['run', 'build'], { cwd: projectRoot, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const result = spawnSync(
  'python3',
  [
    '-B',
    resolve(projectRoot, 'deployment/ubuntu/build-iso.py'),
    '--base-iso',
    resolve(
      values['base-iso'] ?? resolve(buildRoot, 'cache/ubuntu/ubuntu-26.04.1-live-server-amd64.iso'),
    ),
    '--cache',
    resolve(values.cache ?? resolve(buildRoot, 'cache/offline')),
    ...(values['admin-config'] ? ['--admin-config', resolve(values['admin-config'])] : []),
  ],
  { cwd: projectRoot, env, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
