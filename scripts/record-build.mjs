import { readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, sep } from 'node:path';
import { projectRoot, distRoot } from './build-paths.mjs';
import { readPrivateConfiguration } from './kiosk-config-source.mjs';

const publicBuild = process.env.SHUTTEROS_PUBLIC_BUILD === '1';
const inputs = [];
async function collect(path) {
  const info = await lstat(path);
  if (info.isSymbolicLink()) throw new Error(`Build input cannot be a symlink: ${path}`);
  if (info.isDirectory()) {
    for (const name of await readdir(path)) await collect(resolve(path, name));
  } else if (info.isFile()) inputs.push(path);
}
for (const folder of ['src', 'packages/core/src', 'packages/components/src', 'portable', 'static'])
  await collect(resolve(projectRoot, folder));
for (const file of [
  'package.json',
  'pnpm-lock.yaml',
  'vite.config.ts',
  'vite.portable.config.ts',
  'svelte.config.js',
  'scripts/prepare-branding.mjs',
  'scripts/prepare-portable-configuration.mjs',
  'scripts/kiosk-config-source.mjs',
  'scripts/sync-kiosk-configuration.mjs',
  'scripts/package-notices.mjs',
  'scripts/bundle-inventory.ts',
  'scripts/build-paths.mjs',
])
  await collect(resolve(projectRoot, file));
if (!publicBuild) {
  const privateSettings = readPrivateConfiguration(projectRoot, false);
  if (privateSettings) {
    const branding = privateSettings.configuration;
    inputs.push(privateSettings.sourcePath);
    for (const name of ['organizationLogo', 'partnerOrganizationLogo']) {
      if (!branding[name]) continue;
      const path = resolve(projectRoot, branding[name]);
      if (!path.startsWith(resolve(projectRoot, 'private') + sep))
        throw new Error('Logo must remain in private/');
      await collect(path);
    }
  }
}
const entries = await Promise.all(
  [...new Set(inputs)].map(
    async (path) =>
      `${createHash('sha256')
        .update(await readFile(path))
        .digest('hex')}  ${relative(projectRoot, path).split(sep).join('/')}`,
  ),
);
const sourceSha256 = createHash('sha256').update(entries.sort().join('\n')).digest('hex');
if (process.argv.includes('--fingerprint')) {
  console.log(sourceSha256);
  process.exit(0);
}
const version = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8')).version;
const index = await readFile(resolve(distRoot, 'index.html'));
await writeFile(
  resolve(distRoot, 'build-info.json'),
  JSON.stringify(
    {
      version,
      basePath: process.env.BASE_PATH ?? '',
      publicBuild,
      sourceSha256,
      indexSha256: createHash('sha256').update(index).digest('hex'),
    },
    null,
    2,
  ) + '\n',
);
