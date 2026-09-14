import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse, type DefaultTreeAdapterMap } from 'parse5';

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

test('language navigation keeps the selected locale across guide and home links', async ({
  page,
}) => {
  await page.goto('./index.html?lang=en');
  const guide = page.locator('a[href*="guide/en.html"]').first();
  await expect(guide).toBeVisible();
  await guide.click();
  await expect(page).toHaveURL(/\/guide\/en\.html$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('a[href*="index.html?lang=en"]').first().click();
  await expect(page).toHaveURL(/\/index\.html\?lang=en$/);
});

test('landing exposes the demo and portable download as native links', async ({ page }) => {
  await page.goto('./index.html?lang=en');
  await expect(page.locator('a[href*="demo/?lang=en"]')).toHaveCount(2);
  await expect(page.locator('a[href="demo/portable/shutteros.html"]')).toHaveCount(1);
  await page.locator('a[href*="demo/?lang=en"]').first().click();
  await expect(page).toHaveURL(/\/demo\/\?lang=en$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('landing and guide fit mobile and pass an accessibility smoke scan', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['./fr.html', './guide/fr.html']) {
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
  await page.goto('storybook/iframe.html?id=game-scenes--login&viewMode=story');
  await expect(page.getByRole('textbox', { name: 'Mot de passe', exact: true })).toBeVisible();
  await page.goto('storybook/iframe.html?id=game-scenes--impersonated-sender&viewMode=story');
  await expect(page.locator('[data-challenge="spoof"]')).toBeVisible();
  await expect(page.locator('.mail-list-message')).toHaveCount(2);
  await page.goto('storybook/iframe.html?id=game-scenes--personal-recap&viewMode=story');
  await expect(page.locator('.debrief-list')).toBeVisible();
});
