import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const maxConfigurationBytes = 32 * 1024;
const privateConfiguration = 'private/configuration.json';

export function readPrivateConfiguration(
  root,
  publicBuild = process.env.SHUTTEROS_PUBLIC_BUILD === '1',
) {
  if (publicBuild) return null;
  const local = resolve(root, privateConfiguration);
  const localInfo = lstatSync(local, { throwIfNoEntry: false });
  if (!localInfo) return null;
  if (lstatSync(resolve(root, 'private')).isSymbolicLink() || !localInfo.isFile()) {
    throw new Error(`${privateConfiguration} must be a regular file, not a symlink`);
  }
  const source = readFileSync(local);
  if (source.byteLength > maxConfigurationBytes)
    throw new Error(`${privateConfiguration} must be at most 32 KiB`);
  let configuration;
  try {
    configuration = JSON.parse(source.toString('utf8'));
  } catch (error) {
    throw new Error(`${privateConfiguration} is not valid JSON (${error.message})`);
  }
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration))
    throw new Error(`${privateConfiguration} must contain an object`);
  return { sourcePath: local, configuration };
}

export function readKioskConfiguration(root, publicBuild) {
  const privateSettings = readPrivateConfiguration(root, publicBuild);
  const fallback = resolve(root, 'static/kiosk-config.json');
  const configuration = privateSettings?.configuration.game;
  const sourcePath = configuration === undefined ? fallback : privateSettings.sourcePath;
  const source =
    configuration === undefined
      ? readFileSync(fallback)
      : Buffer.from(JSON.stringify(configuration) + '\n');
  if (source.byteLength > maxConfigurationBytes) {
    throw new Error('kiosk-config.json must be at most 32 KiB');
  }
  let parsed;
  try {
    parsed = JSON.parse(source.toString('utf8'));
  } catch (error) {
    throw new Error(`kiosk-config.json is not valid JSON (${error.message})`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('kiosk-config.json must contain an object');
  return { sourcePath, source, configuration: parsed };
}
