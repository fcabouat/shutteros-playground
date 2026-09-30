import { spawnSync } from 'node:child_process';

// Browser checks exercise the public identity and inject their own branding fixtures.
// Inherit this setting through check/build without renaming the operator's files.
const result = spawnSync('pnpm', ['run', 'verify:checks'], {
  stdio: 'inherit',
  env: { ...process.env, SHUTTEROS_PUBLIC_BUILD: '1' },
  shell: process.platform === 'win32',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
