// Add the small set of notices needed by the documentation site. This is not a
// dependency scanner: the game build already inventories the browser bundle, and
// generated TypeDoc/Storybook assets retain their upstream comments and notices.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const siteRoot = process.env.SITE_ROOT ?? 'dist/site';
const require = createRequire(import.meta.url);
const sections = ['ShutterOS — site software notices'];
let gameNotices;

for (const candidate of [
  'dist/site/demo/THIRD-PARTY-NOTICES.txt',
  'dist/THIRD-PARTY-NOTICES.txt',
]) {
  try {
    gameNotices = await readFile(candidate, 'utf8');
    break;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
if (!gameNotices) {
  throw new Error(
    'Game third-party notices are required; build the game into dist/ before packaging the site.',
  );
}
sections.push(gameNotices);

sections.push(
  'Generated documentation bundles retain the upstream license comments and notices included by their tools. The entries below identify the generators used to produce the redistributed TypeDoc and Storybook pages; their transitive browser assets remain governed by the notices shipped inside those bundles.',
);

// Upstream texts retained because Storybook does not ship a root LICENSE file:
// https://raw.githubusercontent.com/storybookjs/storybook/v10.6.0/LICENSE
// https://raw.githubusercontent.com/googlefonts/NunitoSans/main/OFL.txt
const vendored = [
  ['storybook-10.6.0-MIT.txt', 'Storybook 10.6.0 (MIT)'],
  ['nunito-sans-OFL-1.1.txt', 'Nunito Sans (SIL Open Font License 1.1)'],
];
for (const [file, title] of vendored) {
  const license = await readFile(new URL(`../site/licenses/${file}`, import.meta.url), 'utf8');
  sections.push(`${title}\n${'='.repeat(60)}\n${license}`);
}

for (const name of ['typedoc', 'lunr']) {
  const typedocPackage = require.resolve('typedoc/package.json');
  const packageJson = require.resolve(`${name}/package.json`, {
    paths: [path.dirname(typedocPackage)],
  });
  const pkg = JSON.parse(await readFile(packageJson, 'utf8'));
  const license = await readFile(path.join(path.dirname(packageJson), 'LICENSE'), 'utf8');
  sections.push(`${pkg.name} ${pkg.version} (${pkg.license})\n${'='.repeat(60)}\n${license}`);
}

await mkdir(siteRoot, { recursive: true });
await writeFile(path.join(siteRoot, 'THIRD-PARTY-NOTICES.txt'), `${sections.join('\n\n')}\n`);
console.log(`Site notices: ${path.join(siteRoot, 'THIRD-PARTY-NOTICES.txt')}`);
