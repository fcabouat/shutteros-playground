// Single source of truth for the release version: the root application package,
// mirrored into the independently checked core and component packages. Used by the
// Gitflow hooks in .gitflow/hooks; tests/unit/version.test.ts covers the rules.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageFiles = [
  'package.json',
  'packages/core/package.json',
  'packages/components/package.json',
];
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** @param {unknown} value */
export function isVersion(value) {
  return typeof value === 'string' && semver.test(value);
}

/**
 * Return the next version for a bump keyword, or the explicit version itself.
 * @param {string} current
 * @param {string} request
 */
export function nextVersion(current, request) {
  const match = semver.exec(current);
  if (!match) throw new Error(`current version is not X.Y.Z: ${current}`);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
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

/**
 * Read the version of the working tree, or of a git ref such as main (the hotfix base).
 * @param {string} root
 * @param {string} [ref]
 */
export function readVersion(root, ref) {
  const source = ref
    ? execFileSync('git', ['show', `${ref}:package.json`], { cwd: root, encoding: 'utf8' })
    : readFileSync(resolve(root, 'package.json'), 'utf8');
  const manifest = JSON.parse(source);
  if (!isVersion(manifest.version))
    throw new Error(`${ref ?? 'package.json'} has no X.Y.Z version`);
  return manifest.version;
}

/**
 * Read and validate every version mirrored for a release.
 * @param {string} root
 * @param {string} [ref]
 * @returns {string[]}
 */
export function readVersions(root, ref) {
  return packageFiles.map((file) => {
    const source = ref
      ? execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, encoding: 'utf8' })
      : readFileSync(resolve(root, file), 'utf8');
    const version = JSON.parse(source).version;
    if (!isVersion(version)) throw new Error(`${ref ? `${ref}:` : ''}${file} has no X.Y.Z version`);
    return version;
  });
}

/**
 * Rewrite the version field only; keep Prettier's two-space layout and final newline.
 * @param {string} root
 * @param {string} version
 */
export function writeVersion(root, version) {
  if (!isVersion(version)) throw new Error(`refusing to write a non X.Y.Z version: ${version}`);
  for (const file of packageFiles) {
    const path = resolve(root, file);
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    manifest.version = version;
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

/**
 * Validate the immutable Git evidence used to publish a release. The graph proves
 * the configured two-merge finish shape; Git cannot identify which client created it.
 * @param {string} root
 * @param {string} tag
 * @param {string} [testedCommit]
 * @returns {string}
 */
export function validateTag(root, tag, testedCommit = 'HEAD') {
  const version = tag.startsWith('v') ? tag.slice(1) : '';
  if (!isVersion(version)) throw new Error(`release tag is not vX.Y.Z: ${tag}`);

  /** @param {...string} args */
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const tagRef = `refs/tags/${tag}`;
  if (git('cat-file', '-t', tagRef) !== 'tag') {
    throw new Error(`${tag} must be an annotated tag`);
  }
  const tagCommit = git('rev-parse', `${tagRef}^{}`);
  const expectedCommit = git('rev-parse', testedCommit);
  if (tagCommit !== expectedCommit) {
    throw new Error(`${tag} points to ${tagCommit}, not tested commit ${expectedCommit}`);
  }

  const versions = readVersions(root, tagCommit);
  if (versions.some((candidate) => candidate !== version)) {
    throw new Error(`${tag} does not match package versions: ${versions.join(', ')}`);
  }

  try {
    git('merge-base', '--is-ancestor', tagCommit, 'origin/main');
  } catch {
    throw new Error(`${tagCommit} is not on origin/main`);
  }

  const taggedParents = git('rev-list', '--parents', '-n', '1', tagCommit).split(/\s+/);
  if (taggedParents.length !== 3) {
    throw new Error(`${tag} must identify the two-parent main merge from a Gitflow finish`);
  }
  const deliveryTip = taggedParents[2];
  const developMerges = git('rev-list', '--first-parent', '--merges', '--parents', 'origin/develop')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split(/\s+/));
  const hasBackMerge = developMerges.some(
    (parents) => parents.length === 3 && parents[2] === deliveryTip,
  );
  if (!hasBackMerge) {
    throw new Error(
      `${tag} delivery tip ${deliveryTip} is not the second parent of a develop finish merge`,
    );
  }
  return version;
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
    } else if (command === 'validate-tag' && argument) {
      console.log(validateTag(root, argument, rest[0] ?? 'HEAD'));
    } else {
      console.error(
        'usage: node scripts/version.mjs current [--ref <branch>] | next <patch|minor|major|X.Y.Z> [--ref <branch>] | set <X.Y.Z> | validate-tag <vX.Y.Z> [tested-commit]',
      );
      process.exit(2);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
