import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { en } from '@shutteros/core/data/en';
import { fr } from '@shutteros/core/data/fr';
import config from '../../static/kiosk-config.json' with { type: 'json' };

test.use({ locale: 'en-GB' });

for (const delivery of ['http', 'file'] as const) {
  test(`${delivery}: browser locale selects a playable note and a manual choice survives reset`, async ({
    page,
  }) => {
    await page.goto(
      delivery === 'file' ? pathToFileURL(resolve('dist/portable/shutteros.html')).href : './',
    );
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.post-it')).toHaveText('Office2026');
    await page.getByLabel(en.login.password, { exact: true }).fill('Office2026');
    await page.getByRole('button', { name: en.login.enter, exact: true }).click();
    await expect(page.getByText(en.intro.description, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: en.intro.start, exact: true }).click();
    await page.getByRole('button', { name: 'FR', exact: true }).click();
    await page.getByRole('button', { name: fr.shell.logout, exact: true }).click();
    await page.getByRole('button', { name: fr.shell.exitConfirm, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('.post-it')).toHaveText('Bureau2026');
    await page.reload();
    await expect(page.locator('.post-it')).toHaveText('Office2026');
  });
}

test('a custom note stays literal when the browser selects English', async ({ page }) => {
  await page.route('**/kiosk-config.json', (route) =>
    route.fulfill({ json: { ...config, acceptedPasswords: ['Invitation2026', 'password'] } }),
  );
  await page.goto('./');
  await expect(page.locator('.post-it')).toHaveText('Invitation2026');
  await page.getByLabel(en.login.password, { exact: true }).fill('Invitation2026');
  await page.getByRole('button', { name: en.login.enter, exact: true }).click();
  await expect(page.getByText(en.intro.description, { exact: true })).toBeVisible();
});

for (const delivery of ['http', 'file'] as const) {
  test(`${delivery}: an explicit language query overrides the browser locale and survives reset`, async ({
    page,
  }) => {
    await page.goto(
      `${delivery === 'file' ? pathToFileURL(resolve('dist/portable/shutteros.html')).href : './'}?lang=fr`,
    );
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByLabel(fr.login.password, { exact: true })).toBeVisible();
    await page.getByLabel(fr.login.password, { exact: true }).fill('Bureau2026');
    await page.getByRole('button', { name: fr.login.enter, exact: true }).click();
    await page.getByRole('button', { name: fr.intro.start, exact: true }).click();
    await page.getByRole('button', { name: fr.shell.logout, exact: true }).click();
    await page.getByRole('button', { name: fr.shell.exitConfirm, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });
}
