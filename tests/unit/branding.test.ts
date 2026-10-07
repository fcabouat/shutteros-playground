import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execFileAsync = promisify(execFile);
const script = fileURLToPath(new URL('../../scripts/prepare-branding.mjs', import.meta.url));
const tinyPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

async function runBranding(branding: unknown, logo = true) {
  const root = await mkdtemp(resolve(tmpdir(), 'shutteros-branding-'));
  await mkdir(resolve(root, 'scripts'));
  await mkdir(resolve(root, 'src/lib'), { recursive: true });
  await mkdir(resolve(root, 'private'));
  await cp(script, resolve(root, 'scripts/prepare-branding.mjs'));
  if (logo) await writeFile(resolve(root, 'private/logo.png'), tinyPng);
  await writeFile(resolve(root, 'private/branding.json'), JSON.stringify(branding));
  return { root, output: resolve(root, 'src/lib/branding.generated.ts') };
}

describe('private branding preparation', () => {
  beforeEach(() => vi.stubEnv('SHUTTEROS_PUBLIC_BUILD', '0'));
  afterEach(() => vi.unstubAllEnvs());

  it('verifies the public identity without reading or changing private configuration', async () => {
    const fixture = await runBranding({ applicationName: 'Private identity' });
    const input = resolve(fixture.root, 'private/branding.json');
    // Even an invalid local configuration must not affect a public verification.
    await writeFile(input, '{invalid private json');
    vi.stubEnv('SHUTTEROS_PUBLIC_BUILD', '1');
    try {
      await execFileAsync(process.execPath, [
        resolve(fixture.root, 'scripts/prepare-branding.mjs'),
      ]);
      const generated = await readFile(fixture.output, 'utf8');
      expect(generated).toContain('"applicationName":"ShutterOS"');
      expect(generated).not.toContain('organizationName');
      expect(await readFile(input, 'utf8')).toBe('{invalid private json');
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('embeds a private PNG and keeps organisation and application names distinct', async () => {
    const fixture = await runBranding({
      applicationName: 'ShutterOS',
      organizationName: 'Example Organisation',
      campaignName: 'Security Week',
      organizationLogo: 'private/logo.png',
    });
    try {
      await execFileAsync(process.execPath, [
        resolve(fixture.root, 'scripts/prepare-branding.mjs'),
      ]);
      const generated = await readFile(fixture.output, 'utf8');
      expect(generated).toContain(
        "import type { Branding } from '@shutteros/components/screens/branding'",
      );
      expect(generated).toContain('ShutterOS');
      expect(generated).toContain('Example Organisation');
      expect(generated).toContain('data:image/png;base64,iVBORw0KGgo=');
      expect(generated).not.toContain('http:');
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('embeds a named partner logo through the same private asset boundary', async () => {
    const fixture = await runBranding({
      applicationName: 'ShutterOS',
      partnerOrganizationName: 'Partner organisation',
      partnerOrganizationLogo: 'private/partner.png',
    });
    try {
      await writeFile(resolve(fixture.root, 'private/partner.png'), tinyPng);
      await execFileAsync(process.execPath, [
        resolve(fixture.root, 'scripts/prepare-branding.mjs'),
      ]);
      const generated = await readFile(fixture.output, 'utf8');
      expect(generated).toContain(
        "import type { Branding } from '@shutteros/components/screens/branding'",
      );
      expect(generated).toContain('Partner organisation');
      expect(generated).toContain('partnerOrganizationLogo');
      expect(generated).toContain('data:image/png;base64,iVBORw0KGgo=');
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it.each([
    [
      'non-boolean name visibility',
      { applicationName: 'ShutterOS', showOrganizationNames: 'false' },
    ],
    ['unknown key', { applicationName: 'ShutterOS', unexpected: true }],
    ['outside path', { applicationName: 'ShutterOS', organizationLogo: 'private/../outside.png' }],
    [
      'remote path',
      { applicationName: 'ShutterOS', organizationLogo: 'https://example.test/logo.png' },
    ],
    [
      'partner logo without a named partner',
      { applicationName: 'ShutterOS', partnerOrganizationLogo: 'private/logo.png' },
    ],
  ])('rejects %s branding input', async (_label, branding) => {
    const fixture = await runBranding(branding, false);
    try {
      await expect(
        execFileAsync(process.execPath, [resolve(fixture.root, 'scripts/prepare-branding.mjs')]),
      ).rejects.toThrow('Branding:');
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it.each([true, false])(
    'preserves explicit name visibility %s in the generated identity',
    async (showOrganizationNames) => {
      const fixture = await runBranding({ applicationName: 'ShutterOS', showOrganizationNames });
      try {
        await execFileAsync(process.execPath, [
          resolve(fixture.root, 'scripts/prepare-branding.mjs'),
        ]);
        expect(await readFile(fixture.output, 'utf8')).toContain(
          `"showOrganizationNames":${showOrganizationNames}`,
        );
      } finally {
        await rm(fixture.root, { recursive: true, force: true });
      }
    },
  );

  it('serializes branding text without literal HTML delimiters', async () => {
    const fixture = await runBranding({
      applicationName: '</ScRiPt><script>globalThis.compromised = true</script>',
      organizationName: 'Research & Development',
      campaignName: 'Line\u2028break',
    });
    try {
      await execFileAsync(process.execPath, [
        resolve(fixture.root, 'scripts/prepare-branding.mjs'),
      ]);
      const generated = await readFile(fixture.output, 'utf8');
      expect(generated).not.toMatch(/[<>&\u2028\u2029]/u);
      expect(generated).toContain('\\u003c/ScRiPt\\u003e');
      expect(generated).toContain('Research \\u0026 Development');
      expect(generated).toContain('Line\\u2028break');
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
