import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const eslint = new ESLint({ cwd: root, overrideConfigFile: 'eslint.config.js' });

async function lintCore(source: string) {
  // A production-path virtual file selects the real flat-config overrides. Inspect
  // rule IDs so an unrelated lint error cannot masquerade as a working boundary.
  const results = await eslint.lintText(source, { filePath: 'packages/core/src/probe.ts' });
  return results.flatMap((result) => result.messages.map((message) => message.ruleId));
}

describe('core package boundaries', () => {
  it('blocks framework and cross-layer imports from core', async () => {
    expect(await lintCore("import { onMount } from 'svelte';")).toContain('no-restricted-imports');
    expect(await lintCore("import { Button } from '../components/fake';")).toContain(
      'no-restricted-imports',
    );
  });

  it('blocks ambient clocks and random values from core', async () => {
    expect(await lintCore('export const now = Date.now();')).toContain('no-restricted-globals');
    expect(await lintCore('export const sample = Math.random();')).toContain(
      'no-restricted-properties',
    );
  });

  it('allows a relative, framework-free core source', async () => {
    expect(
      await lintCore(
        "import type { GameState } from '../model/game'; export type State = GameState;",
      ),
    ).toEqual([]);
  });

  it('declares no package dependencies', async () => {
    const contents = await readFile(
      new URL('../../packages/core/package.json', import.meta.url),
      'utf8',
    );
    const manifest: unknown = JSON.parse(contents);
    expect(manifest).toMatchObject({ name: '@shutteros/core', private: true, sideEffects: false });
    expect(manifest).not.toHaveProperty('dependencies');
    expect(manifest).not.toHaveProperty('devDependencies');
  });
});
