// Single source of truth for the release version: the root package.json, mirrored
// into packages/core so both workspace packages keep the same version (the pair
// was previously kept in sync by a Changesets "fixed" group). Used by the git-flow
// hooks in .gitflow/hooks; tests/unit/version.test.ts covers the bump rules.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageFiles = ['package.json', 'packages/core/package.json'];
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function isVersion(value) {
  return typeof value === 'string' && semver.test(value);
}

/** Return the next version for a bump keyword, or the explicit version itself. */
export function nextVersion(current, request) {
  if (!isVersion(current)) throw new Error(`current version is not X.Y.Z: ${current}`);
  const [major, minor, patch] = current.split('.').map(Number);
  switch (request) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default: {
      const explicit = request.replace(/^v/, '');
      if (!isVersion(explicit)) throw new Error(`unsupported version request: ${request}`);
      return explicit;
    }
  }
}

/** Read the version of the working tree, or of a git ref such as main (the hotfix base). */
export function readVersion(root, ref) {
  const source = ref
    ? execFileSync('git', ['show', `${ref}:package.json`], { cwd: root, encoding: 'utf8' })
    : readFileSync(resolve(root, 'package.json'), 'utf8');
  const manifest = JSON.parse(source);
  if (!isVersion(manifest.version))
    throw new Error(`${ref ?? 'package.json'} has no X.Y.Z version`);
  return manifest.version;
}

/** Rewrite the version field only; keep Prettier's two-space layout and final newline. */
export function writeVersion(root, version) {
  if (!isVersion(version)) throw new Error(`refusing to write a non X.Y.Z version: ${version}`);
  for (const file of packageFiles) {
    const path = resolve(root, file);
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    manifest.version = version;
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const [command, argument, ...rest] = process.argv.slice(2);
  const ref = rest[0] === '--ref' ? rest[1] : undefined;
  try {
    if (command === 'current') {
      console.log(readVersion(root, ref));
    } else if (command === 'next' && argument) {
      console.log(nextVersion(readVersion(root, ref), argument));
    } else if (command === 'set' && argument) {
      writeVersion(root, nextVersion(readVersion(root), argument));
      console.log(readVersion(root));
    } else {
      console.error(
        'usage: node scripts/version.mjs current [--ref <branch>] | next <patch|minor|major|X.Y.Z> [--ref <branch>] | set <X.Y.Z>',
      );
      process.exit(2);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
