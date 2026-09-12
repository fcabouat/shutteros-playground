import { readFile, writeFile, readdir, stat, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Inventory rendered JavaScript in both deliveries. Tailwind's emitted CSS also needs its license.
const manifests = ['dist/bundled-packages.json', 'dist/portable/bundled-packages.json'];
const manifest = new Set([await realpath('node_modules/tailwindcss')]);
for (const file of manifests) {
  const directories = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(directories) || directories.some((directory) => typeof directory !== 'string'))
    throw new Error(`Invalid bundled dependency manifest ${file}`);
  for (const directory of directories) manifest.add(directory);
}
const entries = [];
for (const directory of manifest) {
  const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  const licenses = (await readdir(directory))
    .filter((name) => /^(licen[cs]e|copying)(\.|$)/i.test(name))
    .sort();
  if (licenses.length === 0)
    throw new Error(`No license text found for bundled dependency ${pkg.name}`);
  const texts = [];
  for (const name of licenses) {
    const file = path.join(directory, name);
    if ((await stat(file)).isFile()) texts.push(await readFile(file, 'utf8'));
  }
  if (texts.length === 0)
    throw new Error(`No license file found for bundled dependency ${pkg.name}`);
  entries.push(`${pkg.name} ${pkg.version}\n${'='.repeat(60)}\n${texts.join('\n')}\n`);
}
entries.sort();
const notices = ['ShutterOS — Third-party software notices', ...entries].join('\n\n');
await writeFile('dist/THIRD-PARTY-NOTICES.txt', notices);
const sourceNoticesPath = 'static/THIRD-PARTY-NOTICES.txt';
let sourceNotices;
try {
  sourceNotices = await readFile(sourceNoticesPath, 'utf8');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
if (sourceNotices?.trimEnd() !== notices.trimEnd()) {
  if (process.argv.includes('--update-source')) {
    await writeFile(sourceNoticesPath, notices);
    console.log(`Updated ${sourceNoticesPath}; run pnpm build again before publishing.`);
  } else {
    throw new Error(
      `Redistributed package notices changed. Run "pnpm notices:update" now, then run "pnpm build" again.`,
    );
  }
}
const license = await readFile('LICENSE', 'utf8');
await writeFile('dist/LICENSE', license);
const escape = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
let html = await readFile('dist/portable/index.html', 'utf8');
const scriptOpenings = html.match(/<script\b/gi) ?? [];
const scriptClosings = html.match(/<\/script\b/gi) ?? [];
if (scriptOpenings.length !== 1 || scriptClosings.length !== 1) {
  throw new Error(
    `Portable artifact must contain exactly one script element (found ${scriptOpenings.length} opening and ${scriptClosings.length} closing tags)`,
  );
}
const styleOpenings = html.match(/<style\b/gi) ?? [];
const styleClosings = html.match(/<\/style\b/gi) ?? [];
if (styleOpenings.length !== 1 || styleClosings.length !== 1) {
  throw new Error(
    `Portable artifact must contain exactly one style element (found ${styleOpenings.length} opening and ${styleClosings.length} closing tags)`,
  );
}
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(
  (match) => match[1],
);
if (scripts.length !== 1) throw new Error('Unable to identify the portable inline script');
const hashes = scripts
  .map((script) => `'sha256-${createHash('sha256').update(script).digest('base64')}'`)
  .join(' ');
const policy = `default-src 'none'; script-src ${hashes}; script-src-attr 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
html = html.replace(
  '<head>',
  `<head>\n<meta http-equiv="Content-Security-Policy" content="${policy}">`,
);
html = html.replace(
  '</body>',
  `<template id="third-party-notices"><pre>${escape(notices)}</pre></template>\n</body>`,
);
await writeFile('dist/portable/shutteros.html', html);
// Do not distribute intermediate artifacts or build-machine paths.
for (const file of [...manifests, 'dist/portable/index.html']) await rm(file);
console.log(
  `Portable artifact: dist/portable/shutteros.html (${Math.round(Buffer.byteLength(html) / 1024)} KiB; ${entries.length} bundled package notices).`,
);
