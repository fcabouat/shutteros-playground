import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @param {string} root */
export function buildPaths(root) {
  const projectRoot = resolve(root);
  const buildRoot = resolve(projectRoot, '../shutteros-build');
  const distRoot = resolve(buildRoot, 'dist');
  /** @param {...string} segments */
  const distPath = (...segments) => resolve(distRoot, ...segments);
  return { projectRoot, buildRoot, distRoot, distPath };
}

export const { projectRoot, buildRoot, distRoot, distPath } = buildPaths(
  fileURLToPath(new URL('..', import.meta.url)),
);
