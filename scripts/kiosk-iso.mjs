import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
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
const configRoot = resolve(buildRoot, 'config');
await mkdir(configRoot, { recursive: true, mode: 0o700 });
const adminPath = resolve(values['admin-config'] ?? resolve(configRoot, 'operator.json'));
try {
  await readFile(adminPath);
} catch (error) {
  if (values['admin-config'] || error.code !== 'ENOENT') throw error;
  const password = randomBytes(24).toString('base64url');
  const result = spawnSync('openssl', ['passwd', '-6', '-stdin'], {
    input: password + '\n',
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error('openssl could not generate the administrator password hash.');
  await writeFile(resolve(configRoot, 'operator-password.txt'), password + '\n', {
    mode: 0o600,
    flag: 'wx',
  });
  await writeFile(
    adminPath,
    JSON.stringify(
      {
        username: 'kiosk-admin',
        password_hash: result.stdout.trim(),
        hostname_prefix: 'shutteros',
        locale: 'fr_FR.UTF-8',
        keyboard_layout: 'fr',
      },
      null,
      2,
    ) + '\n',
    { mode: 0o600, flag: 'wx' },
  );
  console.log(
    `Administrator: kiosk-admin. Password stored locally in ${resolve(configRoot, 'operator-password.txt')}`,
  );
}
await chmod(configRoot, 0o700);
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
    '--admin-config',
    adminPath,
  ],
  { cwd: projectRoot, env, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
