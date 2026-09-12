import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { parse, type DefaultTreeAdapterMap } from 'parse5';

const execFileAsync = promisify(execFile);
const script = fileURLToPath(new URL('../../scripts/package-notices.mjs', import.meta.url));
const fixtureNotices = `ShutterOS — Third-party software notices\n\n${`tailwindcss 1.2.3\n${'='.repeat(60)}\nDependency license\n`}`;

// A minimal installed-package tree isolates packaging rules from Vite and the current
// lockfile. Tailwind is present because its CSS attribution is an explicit inventory input.
async function fixtureFor(html: string) {
  const root = await mkdtemp(resolve(tmpdir(), 'shutteros-notices-'));
  const dependency = resolve(root, 'node_modules/tailwindcss');
  await mkdir(resolve(root, 'static'));
  await mkdir(resolve(root, 'dist/portable'), { recursive: true });
  await mkdir(dependency, { recursive: true });
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
  it.each(['</script>', '</SCRIPT>', '</script >', '</script data-marker>', '</script/>'])(
    'hashes browser-interpreted script text with end tag %s',
    async (endTag) => {
      const source = 'globalThis.ready = true;\r\n// A second line\r';
      const root = await fixtureFor(
        `<html><head><style></style></head><body><ScRiPt data-label="a > b">${source}${endTag}</body></html>`,
      );
      try {
        await execFileAsync(process.execPath, [script], { cwd: root });
        const packaged = await readFile(resolve(root, 'dist/portable/shutteros.html'), 'utf8');
        const hash = createHash('sha256')
          .update('globalThis.ready = true;\n// A second line\n')
          .digest('base64');
        expect(packaged).toContain(`script-src 'sha256-${hash}'`);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  it('hashes the single inline script and embeds escaped notices', async () => {
    const source = 'globalThis.ready = true;';
    const root = await fixtureFor(
      `<html><head><style>body { color: black; }</style></head><body><script>${source}</script></body></html>`,
    );
    try {
      await execFileAsync(process.execPath, [script], {
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
        execFileAsync(process.execPath, [script], {
          cwd: root,
        }),
      ).rejects.toThrow('pnpm notices:update');

      await execFileAsync(process.execPath, [script, '--update-source'], { cwd: root });
      await expect(
        readFile(resolve(root, 'static/THIRD-PARTY-NOTICES.txt'), 'utf8'),
      ).resolves.toContain('tailwindcss 1.2.3');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('preserves replacement tokens literally and redistributes supplemental NOTICE text', async () => {
    const root = await fixtureFor(
      '<html><head><style></style></head><body><SCRIPT>0;</SCRIPT></body></html>',
    );
    try {
      const text = "Legal tokens: $& $` $' <example> </pre><ScRiPt>1</script >";
      await writeFile(resolve(root, 'node_modules/tailwindcss/NOTICE'), text);
      await execFileAsync(process.execPath, [script, '--update-source'], { cwd: root });
      const packaged = await readFile(resolve(root, 'dist/portable/shutteros.html'), 'utf8');
      expect(packaged).toContain("Legal tokens: $&amp; $` $' &lt;example&gt;");
      const names = nodeNames(parse(packaged));
      expect(names.filter((name) => name === 'body')).toHaveLength(1);
      expect(names.filter((name) => name === 'script')).toHaveLength(1);
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
        execFileAsync(process.execPath, [script], {
          cwd: root,
        }),
      ).rejects.toThrow('No license file found');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each(['</ScRiPt data-breakout>', '</script >', '</SCRIPT/>'])(
    'rejects an extra script after premature termination with %s',
    async (endTag) => {
      const root = await fixtureFor(
        `<html><head><style>body { color: black; }</style></head><body><script>const value = "${endTag}<script>globalThis.compromised = true</script>";</script></body></html>`,
      );
      try {
        await expect(
          execFileAsync(process.execPath, [script], {
            cwd: root,
          }),
        ).rejects.toThrow('must contain exactly one script element');
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  it.each([
    ['an external script', '<script src="bundle.js"></script>'],
    ['an unclosed script', '<script>globalThis.ready = true;'],
    ['an extra template script', '<script>0;</script><template><script>1;</script></template>'],
  ])('refuses to authorize %s', async (_label, scripts) => {
    const root = await fixtureFor(
      `<html><head><style></style></head><body>${scripts}</body></html>`,
    );
    try {
      await expect(execFileAsync(process.execPath, [script], { cwd: root })).rejects.toThrow(
        'Portable artifact',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function nodeNames(node: DefaultTreeAdapterMap['node']): string[] {
  return [
    node.nodeName,
    ...('childNodes' in node ? node.childNodes.flatMap(nodeNames) : []),
    ...('content' in node ? nodeNames(node.content) : []),
  ];
}
