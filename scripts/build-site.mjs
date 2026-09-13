import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Marked } from 'marked';
import { parse } from 'parse5';
import { content } from '../site/content.mjs';
import { documentPage, escapeHtml, landing, navigation, repository } from '../site/render.mjs';

// The public site nests the demo, but the kiosk build continues to open the game.
// Rebuild the demo for its real URL: copying a root-based Svelte bundle is not enough.
const base = process.env.BASE_PATH ?? '';
if (base && !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(base)) {
  throw new Error('BASE_PATH must be empty or an absolute path without a trailing slash');
}
if (!process.argv.includes('--assemble-only')) {
  run('build', { BASE_PATH: `${base}/demo` });
  run('build:storybook', { BASE_PATH: '', STORYBOOK_DISABLE_TELEMETRY: '1' });
  run('docs:api');
}
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const output = 'dist/site';
await rm(output, { recursive: true, force: true });
await mkdir(`${output}/demo`, { recursive: true });
for (const entry of await readdir('dist')) {
  if (entry !== 'site') await cp(`dist/${entry}`, `${output}/demo/${entry}`, { recursive: true });
}
await cp('storybook-static', `${output}/storybook`, { recursive: true });
await cp('.site-build/api', `${output}/api`, { recursive: true });
await mkdir(`${output}/assets`, { recursive: true });
for (const file of ['shell.css', 'site.css', 'locale.js']) {
  await cp(`site/${file}`, `${output}/assets/${file}`);
}
await cp('static/favicon.svg', `${output}/assets/favicon.svg`);
await cp('docs/images', `${output}/docs/images`, { recursive: true });
for (const suffix of ['', '.fr'])
  await cp(`docs/images/desktop${suffix}.png`, `${output}/assets/desktop${suffix}.png`);
await cp('LICENSE', `${output}/LICENSE`);
await cp('dist/THIRD-PARTY-NOTICES.txt', `${output}/THIRD-PARTY-NOTICES.txt`);
for (const locale of ['en', 'fr']) {
  await writeFile(`${output}/${locale === 'en' ? 'index' : 'fr'}.html`, landing(locale, version));
}

const documents = (await readdir('docs'))
  .filter((file) => file.endsWith('.md'))
  .map((file) => `docs/${file}`);
const targets = new Map(documents.map((file) => [file, `docs/${path.basename(file, '.md')}.html`]));
targets.set('docs/user-guide.md', 'guide/en.html');
targets.set('docs/user-guide.fr.md', 'guide/fr.html');
targets.set('docs/overview.md', 'overview.html');

for (const file of documents) {
  const target = targets.get(file);
  const up = '../'.repeat(target.split('/').length - 1);
  const locale = file.endsWith('.fr.md') ? 'fr' : 'en';
  const c = content[locale];
  const source = await readFile(file, 'utf8');
  const title =
    source
      .split('\n')
      .find((line) => line.startsWith('# '))
      ?.slice(2) ?? 'Documentation';
  const headingCounts = new Map();
  // Only committed Markdown is rendered. Resolve its relative links against the
  // source file so guides also work when served below a repository Pages prefix.
  const markdown = new Marked({
    renderer: {
      heading({ tokens, depth }) {
        const label = this.parser.parseInline(tokens);
        const plain = tokens.map((token) => token.text ?? '').join('');
        const slug = plain
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s_-]/gu, '')
          .replace(/\s+/g, '-');
        const count = headingCounts.get(slug) ?? 0;
        headingCounts.set(slug, count + 1);
        return `<h${depth} id="${escapeHtml(slug + (count ? `-${count}` : ''))}">${label}</h${depth}>`;
      },
      link({ href, tokens, title }) {
        return `<a href="${escapeHtml(resolveLink(href, file, target))}"${title ? ` title="${escapeHtml(title)}"` : ''}>${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href, text }) {
        return `<img src="${escapeHtml(resolveLink(href, file, target))}" alt="${escapeHtml(text)}" loading="lazy">`;
      },
    },
  });
  const body = `<main id="main" class="document wrap"><a class="back-link" href="${up}${locale === 'fr' ? 'fr.html' : 'index.html?lang=en'}">← ${c.back}</a>${markdown.parse(source)}</main>`;
  await mkdir(path.dirname(`${output}/${target}`), { recursive: true });
  await writeFile(
    `${output}/${target}`,
    documentPage({
      locale,
      title: `${title} · ShutterOS`,
      body,
      section: file.includes('user-guide') ? 'guide' : 'docs',
      up,
      version,
    }),
  );
}

// Insert navigation into generated copies, leaving the upstream assets intact.
// Source locations avoid reserializing scripts or relying on HTML tag regexes.
for await (const file of htmlFiles(`${output}/api`)) {
  await addNavigation(
    file,
    path.relative(path.dirname(file), output).split(path.sep).join('/') + '/',
    false,
  );
}
await addNavigation(`${output}/storybook/index.html`, '../', true);
const notices = spawnSync(process.execPath, ['scripts/site-notices.mjs'], { stdio: 'inherit' });
if (notices.status !== 0) throw new Error('Site notice packaging failed');
console.log(`Product site: ${output}/ (demo base ${base}/demo)`);

function run(script, extraEnv = {}) {
  const result = spawnSync('pnpm', [script], {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) throw new Error(`pnpm ${script} failed`);
}

function resolveLink(href, source, target) {
  if (/^(https?:|mailto:)/i.test(href) || href.startsWith('#')) return href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//'))
    throw new Error(`Unsupported documentation link: ${href}`);
  const [pathname, fragment] = href.split('#');
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(source), pathname));
  const local =
    targets.get(resolved) ?? (resolved.startsWith('docs/images/') ? resolved : undefined);
  if (local)
    return (
      path.posix.relative(path.posix.dirname(target), local) + (fragment ? `#${fragment}` : '')
    );
  return `${repository}/blob/main/${resolved}${fragment ? `#${fragment}` : ''}`;
}

async function* htmlFiles(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) yield* htmlFiles(file);
    else if (item.name.endsWith('.html')) yield file;
  }
}

async function addNavigation(file, up, storybook) {
  let html = await readFile(file, 'utf8');
  const nodes = [];
  const visit = (node) => {
    nodes.push(node);
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(parse(html, { sourceCodeLocationInfo: true }));
  const head = nodes.find((node) => node.tagName === 'head')?.sourceCodeLocation;
  const body = nodes.find((node) => node.tagName === 'body')?.sourceCodeLocation;
  if (!head?.endTag || !body?.startTag) throw new Error(`Missing document structure: ${file}`);
  const additions = [
    [head.endTag.startOffset, `<link rel="stylesheet" href="${up}assets/shell.css">`],
    [
      body.startTag.endOffset,
      `<div${storybook ? ' class="storybook-site-nav"' : ''}>${navigation('en', 'docs', up)}</div>`,
    ],
  ];
  for (const [offset, text] of additions.sort((a, b) => b[0] - a[0]))
    html = html.slice(0, offset) + text + html.slice(offset);
  await writeFile(file, html);
}
