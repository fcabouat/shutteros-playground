import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const script = fileURLToPath(new URL('../../scripts/package-notices.mjs', import.meta.url));
const fixtureNotices = `ShutterOS — Third-party software notices\n\n${`tailwindcss 1.2.3\n${'='.repeat(60)}\nDependency license\n`}`;

// A minimal installed-package tree isolates packaging rules from Vite and the current
// lockfile. Tailwind is present because its CSS attribution is an explicit inventory input.
async function fixtureFor(html: string) {
  const root = await mkdtemp(resolve(tmpdir(), 'shutteros-notices-'));
  const dependency = resolve(root, 'node_modules/tailwindcss');
  await mkdir(resolve(root, 'scripts'));
  await mkdir(resolve(root, 'static'));
  await mkdir(resolve(root, 'dist/portable'), { recursive: true });
  await mkdir(dependency, { recursive: true });
  await cp(script, resolve(root, 'scripts/package-notices.mjs'));
  await writeFile(resolve(root, 'LICENSE'), 'Application license');
  await writeFile(
    resolve(dependency, 'package.json'),
    JSON.stringify({ name: 'tailwindcss', version: '1.2.3' }),
  );
  await writeFile(resolve(dependency, 'LICENSE'), 'Dependency license');
  await writeFile(resolve(root, 'dist/bundled-packages.json'), '[]');
  await writeFile(resolve(root, 'dist/portable/bundled-packages.json'), '[]');
  await writeFile(resolve(root, 'dist/portable/index.html'), html);
  await writeFile(resolve(root, 'static/THIRD-PARTY-NOTICES.txt'), fixtureNotices);
  return root;
}

describe('portable artifact packaging', () => {
  it('hashes the single inline script and embeds escaped notices', async () => {
    const source = 'globalThis.ready = true;';
    const root = await fixtureFor(
      `<html><head><style>body { color: black; }</style></head><body><script>${source}</script></body></html>`,
    );
    try {
      await execFileAsync(process.execPath, [resolve(root, 'scripts/package-notices.mjs')], {
        cwd: root,
      });
      const packaged = await readFile(resolve(root, 'dist/portable/shutteros.html'), 'utf8');
      const hash = createHash('sha256').update(source).digest('base64');
      expect(packaged).toContain(`script-src 'sha256-${hash}'`);
      expect(packaged).toContain("script-src-attr 'none'");
      expect(packaged).toContain('Dependency license');
      // The app bundle embeds MIT; this packaging-only fixture has no app bundle.
      // Packaging copies LICENSE as a file but must not append another copy to the HTML.
      expect(packaged.match(/Application license/g)).toBeNull();
      expect(packaged).not.toContain('bundled-packages.json');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('requires an explicit source-notice refresh when the inventory changes', async () => {
    const root = await fixtureFor(
      '<html><head><style>body { color: black; }</style></head><body><script>globalThis.ready = true;</script></body></html>',
    );
    try {
      await writeFile(resolve(root, 'static/THIRD-PARTY-NOTICES.txt'), 'stale notices');
      await expect(
        execFileAsync(process.execPath, [resolve(root, 'scripts/package-notices.mjs')], {
          cwd: root,
        }),
      ).rejects.toThrow('pnpm notices:update');

      await execFileAsync(
        process.execPath,
        [resolve(root, 'scripts/package-notices.mjs'), '--update-source'],
        { cwd: root },
      );
      await expect(
        readFile(resolve(root, 'static/THIRD-PARTY-NOTICES.txt'), 'utf8'),
      ).resolves.toContain('tailwindcss 1.2.3');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('preserves replacement tokens literally and redistributes supplemental NOTICE text', async () => {
    const root = await fixtureFor(
      '<html><head><style></style></head><body><script>0;</script></body></html>',
    );
    try {
      const text = "Legal tokens: $& $` $' <example>";
      await writeFile(resolve(root, 'node_modules/tailwindcss/NOTICE'), text);
      await execFileAsync(
        process.execPath,
        [resolve(root, 'scripts/package-notices.mjs'), '--update-source'],
        { cwd: root },
      );
      const packaged = await readFile(resolve(root, 'dist/portable/shutteros.html'), 'utf8');
      expect(packaged).toContain("Legal tokens: $&amp; $` $' &lt;example&gt;");
      expect(packaged.match(/<body>/g)).toHaveLength(1);
      expect(packaged.match(/<script>/g)).toHaveLength(1);
      expect(await readFile(resolve(root, 'dist/THIRD-PARTY-NOTICES.txt'), 'utf8')).toContain(text);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not accept a NOTICE file as a substitute for a missing license', async () => {
    const root = await fixtureFor(
      '<html><head><style></style></head><body><script>0;</script></body></html>',
    );
    try {
      await rm(resolve(root, 'node_modules/tailwindcss/LICENSE'));
      await writeFile(resolve(root, 'node_modules/tailwindcss/NOTICE'), 'Acknowledgement only');
      await expect(
        execFileAsync(process.execPath, [resolve(root, 'scripts/package-notices.mjs')], {
          cwd: root,
        }),
      ).rejects.toThrow('No license file found');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects case-insensitive script termination in generated content', async () => {
    const root = await fixtureFor(
      '<html><head><style>body { color: black; }</style></head><body><script>const value = "</ScRiPt data-breakout><script>globalThis.compromised = true</script>";</script></body></html>',
    );
    try {
      await expect(
        execFileAsync(process.execPath, [resolve(root, 'scripts/package-notices.mjs')], {
          cwd: root,
        }),
      ).rejects.toThrow('must contain exactly one script element');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
