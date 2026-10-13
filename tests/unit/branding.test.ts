import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execFileAsync = promisify(execFile);
const script = fileURLToPath(new URL('../../scripts/prepare-branding.mjs', import.meta.url));
const tinyPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

async function runBranding(branding: unknown, logo = true) {
  const root = resolve(await mkdtemp(resolve(tmpdir(), 'shutteros-branding-')), 'source');
  await mkdir(root);
  await mkdir(resolve(root, 'scripts'));
  await mkdir(resolve(root, 'private'));
  await cp(script, resolve(root, 'scripts/prepare-branding.mjs'));
  await cp(
    new URL('../../scripts/kiosk-config-source.mjs', import.meta.url),
    resolve(root, 'scripts/kiosk-config-source.mjs'),
  );
  await cp(
    new URL('../../scripts/build-paths.mjs', import.meta.url),
    resolve(root, 'scripts/build-paths.mjs'),
  );
  if (logo) await writeFile(resolve(root, 'private/logo.png'), tinyPng);
  await writeFile(resolve(root, 'private/configuration.json'), JSON.stringify(branding));
  return { root, output: resolve(root, '../shutteros-build/generated/branding.generated.ts') };
}

function expectSourceBrandingType(generated: string, fixture: { root: string; output: string }) {
  const typeImport = generated.match(/import type \{ Branding \} from (['"])([^'"]+)\1;/)?.[2];
  expect(typeImport).toMatch(/^\.\.?\//);
  expect(resolve(dirname(fixture.output), typeImport ?? '')).toBe(
    resolve(fixture.root, 'packages/components/src/screens/branding'),
  );
}

describe('private branding preparation', () => {
  beforeEach(() => vi.stubEnv('SHUTTEROS_PUBLIC_BUILD', '0'));
  afterEach(() => vi.unstubAllEnvs());

  it('verifies the public identity without reading or changing private configuration', async () => {
    const fixture = await runBranding({ applicationName: 'Private identity' });
    const input = resolve(fixture.root, 'private/configuration.json');
    // Even an invalid local configuration must not affect a public verification.
    await writeFile(input, '{invalid private json');
    vi.stubEnv('SHUTTEROS_PUBLIC_BUILD', '1');
    try {
      await execFileAsync(process.execPath, [
        resolve(fixture.root, 'scripts/prepare-branding.mjs'),
      ]);
      const generated = await readFile(fixture.output, 'utf8');
      expectSourceBrandingType(generated, fixture);
      expect(generated).toContain('"applicationName":"ShutterOS"');
      expect(generated).not.toContain('organizationName');
      expect(await readFile(input, 'utf8')).toBe('{invalid private json');
    } finally {
      await rm(dirname(fixture.root), { recursive: true, force: true });
    }
  });

  it.each(['organizationLogo', 'partnerOrganizationLogo'])(
    'embeds a private SVG for %s',
    async (key) => {
      const fixture = await runBranding({
        [key]: 'private/logo.svg',
        ...(key === 'partnerOrganizationLogo' ? { partnerOrganizationName: 'Partner' } : {}),
      });
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 30"><path d="M0 0h10v30H0z"/></svg>';
      try {
        await writeFile(resolve(fixture.root, 'private/logo.svg'), svg);
        await execFileAsync(process.execPath, [
          resolve(fixture.root, 'scripts/prepare-branding.mjs'),
        ]);
        expect(await readFile(fixture.output, 'utf8')).toContain(
          `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
        );
      } finally {
        await rm(dirname(fixture.root), { recursive: true, force: true });
      }
    },
  );

  it.each(['not an SVG', Buffer.from([0xff, 0xfe])])(
    'rejects invalid SVG content %#',
    async (content) => {
      const fixture = await runBranding({ organizationLogo: 'private/logo.svg' });
      try {
        await writeFile(resolve(fixture.root, 'private/logo.svg'), content);
        await expect(
          execFileAsync(process.execPath, [resolve(fixture.root, 'scripts/prepare-branding.mjs')]),
        ).rejects.toThrow('Branding:');
      } finally {
        await rm(dirname(fixture.root), { recursive: true, force: true });
      }
    },
  );

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
      expectSourceBrandingType(generated, fixture);
      expect(generated).toContain('ShutterOS');
      expect(generated).toContain('Example Organisation');
      expect(generated).toContain('data:image/png;base64,iVBORw0KGgo=');
      expect(generated).not.toContain('http:');
    } finally {
      await rm(dirname(fixture.root), { recursive: true, force: true });
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
      expectSourceBrandingType(generated, fixture);
      expect(generated).toContain('Partner organisation');
      expect(generated).toContain('partnerOrganizationLogo');
      expect(generated).toContain('data:image/png;base64,iVBORw0KGgo=');
    } finally {
      await rm(dirname(fixture.root), { recursive: true, force: true });
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
      await rm(dirname(fixture.root), { recursive: true, force: true });
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
        await rm(dirname(fixture.root), { recursive: true, force: true });
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
      await rm(dirname(fixture.root), { recursive: true, force: true });
    }
  });
});
