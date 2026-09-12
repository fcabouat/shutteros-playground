import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const script = fileURLToPath(
  new URL('../../scripts/prepare-portable-configuration.mjs', import.meta.url),
);

async function fixtureFor(configuration: unknown) {
  const root = await mkdtemp(resolve(tmpdir(), 'shutteros-portable-config-'));
  await mkdir(resolve(root, 'scripts'));
  await mkdir(resolve(root, 'static'));
  await mkdir(resolve(root, 'portable'));
  await cp(script, resolve(root, 'scripts/prepare-portable-configuration.mjs'));
  await writeFile(resolve(root, 'static/kiosk-config.json'), JSON.stringify(configuration));
  return root;
}

async function run(root: string) {
  return execFileAsync(process.execPath, [
    resolve(root, 'scripts/prepare-portable-configuration.mjs'),
  ]);
}

describe('portable configuration preparation', () => {
  it('embeds a bounded SVG separately from script-safe configuration', async () => {
    const root = await fixtureFor({
      organizationName: '</ScRiPt><script>compromised</script>',
      organizationLogo: 'logo-organisation.svg',
    });
    try {
      await writeFile(
        resolve(root, 'static/logo-organisation.svg'),
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
      );
      await run(root);
      const generated = await readFile(
        resolve(root, 'portable/configuration.generated.ts'),
        'utf8',
      );
      expect(generated).toContain('organizationLogo":"logo-organisation.svg');
      expect(generated).toContain('data:image/svg+xml;base64,');
      expect(generated).toContain('\\u003c/ScRiPt\\u003e');
      expect(generated).not.toContain('<script>');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps a logo-free generic configuration logo-free', async () => {
    const root = await fixtureFor({ version: 1 });
    try {
      await run(root);
      await expect(
        readFile(resolve(root, 'portable/configuration.generated.ts'), 'utf8'),
      ).resolves.toContain('embeddedOrganizationLogo: string | undefined = undefined');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    '../outside.svg',
    'images/logo.svg',
    'https://example.test/logo.svg',
    'logo.svg?x',
    `${'a'.repeat(117)}.svg`,
  ])('rejects non-basename logo reference %s', async (organizationLogo) => {
    const root = await fixtureFor({ organizationLogo });
    try {
      await expect(run(root)).rejects.toThrow('must be a local PNG, WebP, or SVG filename');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects missing, oversized, and escaping logo files', async () => {
    const missing = await fixtureFor({ organizationLogo: 'missing.svg' });
    const oversized = await fixtureFor({ organizationLogo: 'oversized.svg' });
    const escaping = await fixtureFor({ organizationLogo: 'linked.svg' });
    try {
      await writeFile(resolve(oversized, 'static/oversized.svg'), Buffer.alloc(256 * 1024 + 1));
      await writeFile(resolve(escaping, 'outside.svg'), '<svg></svg>');
      await symlink(resolve(escaping, 'outside.svg'), resolve(escaping, 'static/linked.svg'));
      await expect(run(missing)).rejects.toThrow('file does not exist');
      await expect(run(oversized)).rejects.toThrow('must be at most 256 KiB');
      await expect(run(escaping)).rejects.toThrow('symlink must resolve inside static/');
    } finally {
      await rm(missing, { recursive: true, force: true });
      await rm(oversized, { recursive: true, force: true });
      await rm(escaping, { recursive: true, force: true });
    }
  });
});
