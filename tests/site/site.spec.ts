import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { fr } from '@shutteros/core/data/fr';

test('published guides and product pages have no broken local links', async () => {
  const root = path.resolve('dist/site');
  const pages = [
    'index.html',
    'fr.html',
    'overview.html',
    'guide/en.html',
    'guide/fr.html',
    ...(await readdir(`${root}/docs`))
      .filter((file) => file.endsWith('.html'))
      .map((file) => `docs/${file}`),
  ];
  function nodes(node: DefaultTreeAdapterMap['node']): DefaultTreeAdapterMap['node'][] {
    return [node, ...('childNodes' in node ? node.childNodes.flatMap(nodes) : [])];
  }
  for (const file of pages) {
    const tree = nodes(parse(await readFile(path.join(root, file), 'utf8')));
    for (const node of tree) {
      if (!('attrs' in node)) continue;
      for (const attr of node.attrs.filter((attr) => ['href', 'src'].includes(attr.name))) {
        const url = new URL(attr.value, `http://site.test/${file}`);
        if (url.origin !== 'http://site.test') continue;
        let target = path.join(root, decodeURIComponent(url.pathname));
        const details = await stat(target);
        if (details.isDirectory()) target = path.join(target, 'index.html');
        const body = await readFile(target);
        if (url.hash) {
          const anchors = nodes(parse(body.toString())).filter(
            (node) =>
              'attrs' in node &&
              node.attrs.some(
                (attr) =>
                  attr.name === 'id' && attr.value === decodeURIComponent(url.hash.slice(1)),
              ),
          );
          expect(anchors.length, `${file}: ${attr.value}`).toBeGreaterThan(0);
        }
      }
    }
  }
});

test('landing follows browser locale and an explicit query override', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveURL(/\/fr\.html$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.goto('./index.html?lang=en');
  await expect(page).toHaveURL(/\/index\.html\?lang=en$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.screenshot({ path: '/tmp/shutteros-site-desktop.png', fullPage: true });
});

test('deployment and branding guides switch between their French and English versions', async ({
  page,
}) => {
  for (const [french, english] of [
    ['docs/kiosk.fr.html', 'docs/kiosk.html'],
    ['docs/branding.fr.html', 'docs/branding.html'],
  ] as const) {
    await page.goto(french);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await page.locator('.site-languages a[hreflang="en"]').click();
    expect(new URL(page.url()).pathname.endsWith(`/${english}`)).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.locator('.site-languages a[hreflang="fr"]').click();
    expect(new URL(page.url()).pathname.endsWith(`/${french}`)).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  }
});

test('landing exposes the demo and portable download as native links', async ({ page }) => {
  await page.goto('./index.html?lang=en');
  await expect(page.locator('a[href*="demo/?lang=en"]')).toHaveCount(2);
  await expect(page.locator('a[href="demo/portable/shutteros.html"]')).toHaveCount(1);
  await page.locator('a[href*="demo/?lang=en"]').first().click();
  await expect(page).toHaveURL(/\/demo\/\?lang=en$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('landing navigation exposes deployment, technical references and branding resources', async ({
  page,
}) => {
  await page.goto('./index.html?lang=en');
  const navigation = page.locator('.site-links');
  for (const href of [
    'demo/?lang=en',
    'docs/kiosk.html',
    'overview.html',
    'api/index.html',
    'storybook/index.html',
  ]) {
    await expect(navigation.locator(`a[href="${href}"]`)).toBeVisible();
  }
  await expect(navigation.locator('a[href^="https://github.com/"]')).toBeVisible();
  await expect(page.locator('.deployment a[href="docs/kiosk.html"]')).toBeVisible();
  await expect(page.locator('.resource[href="docs/branding.html"]')).toBeVisible();
  await expect(page.locator('a[href="guide/en.html"]')).toHaveCount(0);

  await page.goto('./fr.html');
  await expect(page.locator('.deployment a[href="docs/kiosk.fr.html"]')).toBeVisible();
  await expect(page.locator('.resource[href="docs/branding.fr.html"]')).toBeVisible();
});

test('landing and translated documentation fit mobile and pass an accessibility smoke scan', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    './fr.html',
    './docs/kiosk.fr.html',
    './docs/branding.fr.html',
    './guide/fr.html',
  ]) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (path === './fr.html')
      await page.screenshot({ path: '/tmp/shutteros-site-mobile.png', fullPage: true });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test('API and Storybook artifacts load as runnable pages', async ({ request, page }) => {
  await expect((await request.get('api/index.html')).status()).toBe(200);
  await expect((await request.get('storybook/index.html')).status()).toBe(200);
  await page.goto('storybook/index.html');
  await expect(page.locator('#root')).not.toBeEmpty();
  // A rendered manager alone does not prove that the independently built Svelte
  // stories resolve their workspace package and establish the locale context.
  await page.goto('storybook/iframe.html?id=game-scenes--welcome&viewMode=story');
  await expect(page.getByRole('heading', { name: fr.welcome.title })).toBeVisible();
  await expect(page.locator('.welcome-hero')).toBeVisible();
  await expect(page.getByRole('radio', { name: fr.welcome.guided.title })).toBeChecked();
  await expect(page.getByRole('button', { name: fr.welcome.begin, exact: true })).toBeVisible();
  await page.goto('storybook/iframe.html?id=game-scenes--guided-login&viewMode=story');
  await expect(page.getByRole('group', { name: fr.login.guidedQuestion })).toBeVisible();
  await page.goto('storybook/iframe.html?id=game-scenes--login&viewMode=story');
  await expect(page.getByRole('textbox', { name: 'Mot de passe', exact: true })).toBeVisible();
  await page.goto('storybook/iframe.html?id=game-scenes--impersonated-sender&viewMode=story');
  await expect(page.locator('[data-challenge="spoof"]')).toBeVisible();
  await expect(page.locator('.mail-list-message')).toHaveCount(2);
  await page.goto('storybook/iframe.html?id=game-scenes--personal-recap&viewMode=story');
  await expect(
    page.getByRole('heading', { name: fr.debrief.summary.title('Camille Martin', false) }),
  ).toBeVisible();
  await page.getByRole('button', { name: fr.debrief.summary.detailed, exact: true }).click();
  await expect(page.locator('.debrief-list')).toBeVisible();
});
