import { readFile, writeFile, readdir, stat, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';

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
    .filter((name) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name))
    .sort();
  if (licenses.length === 0)
    throw new Error(`No license text found for bundled dependency ${pkg.name}`);
  const texts = [];
  let hasLicense = false;
  for (const name of licenses) {
    const file = path.join(directory, name);
    if ((await stat(file)).isFile()) {
      texts.push(await readFile(file, 'utf8'));
      if (/^(licen[cs]e|copying)(\.|$)/i.test(name)) hasLicense = true;
    }
  }
  if (!hasLicense) throw new Error(`No license file found for bundled dependency ${pkg.name}`);
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
// Development/About reads the committed notice file. Require explicit reconciliation
// with the actual bundle inventory so source previews and shipped licenses agree.
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
// Parse with HTML rules before granting CSP hashes: tag casing, attributes and
// raw-text termination must agree with the browser. This validates our generated
// single-file format; it does not sanitize arbitrary HTML or authorize extra scripts.
const nodes = [...walk(parse(html, { sourceCodeLocationInfo: true }))];
const scripts = nodes.filter((node) => node.tagName === 'script');
const styles = nodes.filter((node) => node.tagName === 'style');
if (scripts.length !== 1) {
  throw new Error(
    `Portable artifact must contain exactly one script element (found ${scripts.length})`,
  );
}
if (styles.length !== 1) {
  throw new Error(
    `Portable artifact must contain exactly one style element (found ${styles.length})`,
  );
}
const script = scripts[0];
if (!script.sourceCodeLocation?.endTag || script.attrs.some((attr) => attr.name === 'src')) {
  throw new Error('Portable artifact requires a closed inline script');
}
// The parser normalizes HTML line endings, as the browser does before CSP checks.
const scriptText = script.childNodes.map((node) => node.value ?? '').join('');
const hashes = `'sha256-${createHash('sha256').update(scriptText).digest('base64')}'`;
const policy = `default-src 'none'; script-src ${hashes}; script-src-attr 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
html = html.replace(
  '<head>',
  `<head>\n<meta http-equiv="Content-Security-Policy" content="${policy}">`,
);
// A template keeps the offline notice text available without another request.
// Escape it before insertion; the browser loader reads content.textContent.
html = html.replace(
  '</body>',
  () => `<template id="third-party-notices"><pre>${escape(notices)}</pre></template>\n</body>`,
);
await writeFile('dist/portable/shutteros.html', html);
// Do not distribute intermediate artifacts or build-machine paths.
for (const file of [...manifests, 'dist/portable/index.html']) await rm(file);
console.log(
  `Portable artifact: dist/portable/shutteros.html (${Math.round(Buffer.byteLength(html) / 1024)} KiB; ${entries.length} bundled package notices).`,
);

function* walk(node) {
  yield node;
  for (const child of node.childNodes ?? []) yield* walk(child);
  // Template content is a separate fragment; do not hide extra scripts there.
  if (node.content) yield* walk(node.content);
}
