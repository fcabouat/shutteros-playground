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

async function lintComponents(source: string) {
  const results = await eslint.lintText(source, {
    filePath: 'packages/components/src/probe.ts',
  });
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

describe('components package boundaries', () => {
  it.each([
    "import Game from '../../../src/lib/app/Game.svelte';",
    "import { browserClock } from '../../../src/lib/infrastructure/clock';",
    "import { decodeConfiguration } from '../../../src/lib/contract/configuration';",
    "import { base } from '$app/paths';",
    "import { branding } from '../../../src/lib/branding.generated';",
  ])('blocks application-owned imports', async (source) => {
    expect(await lintComponents(source)).toContain('no-restricted-imports');
  });

  it('allows Svelte, core and package-relative imports', async () => {
    expect(
      await lintComponents(
        "import { tick } from 'svelte'; import type { Intent } from '@shutteros/core/model/game'; import type { Branding } from './screens/branding'; export { tick }; export type ViewIntent = Intent; export type ViewBranding = Branding;",
      ),
    ).toEqual([]);
  });

  it('declares only its UI and core dependencies and exposes source entry points', async () => {
    const contents = await readFile(
      new URL('../../packages/components/package.json', import.meta.url),
      'utf8',
    );
    const manifest = JSON.parse(contents) as {
      name?: string;
      private?: boolean;
      dependencies?: Record<string, string>;
      exports?: Record<string, string>;
    };
    expect(manifest).toMatchObject({ name: '@shutteros/components', private: true });
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual([
      '@internationalized/date',
      '@lucide/svelte',
      '@shutteros/core',
      'bits-ui',
      'svelte',
    ]);
    expect(manifest.exports).toMatchObject({
      './*.svelte': './src/*.svelte',
      './*.css': './src/*.css',
      './*': './src/*.ts',
    });

    const rootManifest = JSON.parse(
      await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    expect(rootManifest.dependencies?.['@shutteros/components']).toBe('workspace:*');
  });
});
