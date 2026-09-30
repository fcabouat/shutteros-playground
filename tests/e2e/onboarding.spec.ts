import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { fr } from '@shutteros/core/data/fr';
import { en } from '@shutteros/core/data/en';
import config from '../../static/kiosk-config.json' with { type: 'json' };

const portable = pathToFileURL(resolve('dist/portable/shutteros.html')).href;

for (const locale of ['fr', 'en'] as const) {
  for (const delivery of ['http', 'file'] as const) {
    test(`welcome and guided login keep a game bar throughout (${locale}, ${delivery})`, async ({
      page,
    }) => {
      const copy = locale === 'fr' ? fr : en;
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.clock.install();
      await page.goto(delivery === 'file' ? `${portable}?lang=${locale}` : `./?lang=${locale}`);
      await expect(page.getByRole('heading', { name: copy.welcome.title })).toBeVisible();
      await expect(page.getByRole('radio', { name: copy.welcome.guided.title })).toBeChecked();
      await expect(page.locator('.os-topbar')).toBeVisible();
      await expect(page.locator('.welcome-hero')).toBeVisible();
      expect(
        await page
          .locator('.welcome-hero')
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      ).toBeGreaterThan(0);
      const controlsBefore = await page.locator('.session-controls').boundingBox();
      await page.clock.fastForward(31 * 60_000);
      await expect(page.getByRole('heading', { name: copy.welcome.title })).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      if (delivery === 'http')
        await page.screenshot({
          path: `test-results/previews/welcome-${locale}.png`,
          fullPage: true,
        });
      await page.getByRole('button', { name: copy.welcome.begin, exact: true }).click();
      await expect(page.getByRole('group', { name: copy.login.guidedQuestion })).toBeVisible();
      await expect(
        page.getByRole('button', {
          name: copy.login.guidedChoices[0].label(config.passwordManagerName),
          exact: true,
        }),
      ).toBeFocused();
      await expect(page.getByLabel(copy.login.password, { exact: true })).toHaveCount(0);
      const controlsAfter = await page.locator('.session-controls').boundingBox();
      expect(controlsAfter?.y).toBe(controlsBefore?.y);
      await page.clock.fastForward(31 * 60_000);
      await expect(page.getByRole('group', { name: copy.login.guidedQuestion })).toBeVisible();
      await page
        .getByRole('button', {
          name: copy.login.guidedChoices[0].label(config.passwordManagerName),
          exact: true,
        })
        .click();
      await expect(page.getByRole('heading', { name: copy.intro.guidedTitle })).toBeVisible();
      await expect(page.locator('.session-timer')).toContainText('30:00');
      await expect(page.getByRole('heading', { name: copy.intro.title, exact: true })).toHaveCount(
        0,
      );
      await page.getByRole('button', { name: copy.intro.start, exact: true }).click();
      await expect(page.locator('[data-challenge="usb"]')).toBeVisible();
      await expect(page.locator('.action-dock-panel')).toBeVisible();
      await expect(page.locator('.hint-content')).not.toBeVisible();
      await page.locator('.activity-guidance .guidance-trigger').click();
      await expect(page.locator('.hint-content')).toBeVisible();
      await page.keyboard.press('Control+Alt+Home');
      await expect(page.getByRole('heading', { name: copy.welcome.title })).toBeVisible();
      await expect(page.locator('.hint-content')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
}

test('guided storage choices explain mistakes without blocking and use the configured manager as text', async ({
  page,
}) => {
  const manager = '<b>Coffre interne</b>';
  await page.route('**/kiosk-config.json', (route) =>
    route.fulfill({ json: { ...config, passwordManagerName: manager } }),
  );
  for (const choice of fr.login.guidedChoices) {
    await page.goto('./');
    await page.getByRole('button', { name: fr.welcome.begin, exact: true }).click();
    await page.getByRole('button', { name: choice.label(manager), exact: true }).click();
    await expect(
      page.getByRole('heading', {
        name: choice.id === 'manager' ? fr.intro.guidedTitle : fr.intro.guidedRiskTitle,
      }),
    ).toBeVisible();
    await expect(page.locator('.intro-card')).toContainText(manager);
    await expect(page.locator('.intro-card b')).toHaveCount(0);
    await page.getByRole('button', { name: fr.intro.start, exact: true }).click();
    await expect(page.locator('[data-challenge="usb"]')).toBeVisible();
  }
});

test('welcome stays readable on a narrow screen and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: fr.welcome.title })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('radio', { name: fr.welcome.free.title }).check();
  await page.getByRole('button', { name: fr.welcome.begin, exact: true }).click();
  await expect(page.getByLabel(fr.login.password, { exact: true })).toBeVisible();
  await page.locator('.finish-experience').click();
  await expect(page.getByRole('group', { name: fr.login.guidedQuestion })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('recap distinguishes viewed hints from guided choices and survives minimisation', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: fr.welcome.begin, exact: true }).click();
  await page
    .getByRole('button', {
      name: fr.login.guidedChoices[0].label(config.passwordManagerName),
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: fr.intro.start, exact: true }).click();
  const hint = page.locator('.activity-guidance .guidance-trigger');
  await hint.click();
  await expect(page.locator('.hint-content')).toBeVisible();
  await hint.click();
  await hint.click();
  await expect(page.locator('.hint-content')).toBeVisible();
  await hint.click();
  await page.locator('.action-dock-panel [data-choice="station"]').click();
  await expect(page.locator('.feedback-card')).toBeVisible();
  await page.locator('.finish-experience').click();
  await expect(page.locator('.feedback-card')).toBeVisible();
  await page.locator('.finish-experience').click();
  await expect(page.locator('.feedback-card')).toBeVisible();
  await page.getByRole('button', { name: fr.experience.next, exact: true }).click();
  for (const choice of ['isolate', 'notify', 'report', 'report', 'known-address', 'deny-report']) {
    await page.locator(`.action-dock-panel [data-choice="${choice}"]`).click();
    if (choice !== 'isolate')
      await page.getByRole('button', { name: fr.experience.next, exact: true }).click();
  }
  const chat = page.locator('.ai-chat');
  await chat.getByRole('button', { name: fr.ai.connect, exact: true }).click();
  await chat.getByRole('radio', { name: fr.ai.generic, exact: true }).check();
  await chat.getByRole('button', { name: fr.ai.send, exact: true }).click();
  await page.getByRole('button', { name: fr.experience.next, exact: true }).click();
  await page
    .getByRole('button', {
      name: fr.routines.passwordAction(config.passwordManagerName),
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: fr.routines.updateAction, exact: true }).click();
  await page.getByRole('button', { name: fr.routines.lockAction, exact: true }).click();
  await page.getByRole('button', { name: fr.routines.unlock, exact: true }).click();
  await page.getByRole('button', { name: fr.experience.review, exact: true }).click();
  await expect(page.getByRole('heading', { name: fr.debrief.summary.title })).toBeVisible();
  await expect(page.getByText(fr.debrief.summary.hints(1), { exact: true })).toBeVisible();
  await expect(page.getByText(fr.debrief.summary.modes.mixed, { exact: true })).toBeVisible();
  await expect(page.getByText(fr.debrief.summary.situations(7), { exact: true })).toBeVisible();
  await expect(page.getByText(fr.debrief.summary.habits(3), { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/previews/journey-summary.png' });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: fr.debrief.summary.detailed, exact: true }).click();
  await expect(page.getByRole('heading', { name: fr.debrief.title })).toBeVisible();
  await expect(page.getByRole('heading', { name: fr.debrief.title })).toBeFocused();
  await page.getByRole('button', { name: fr.os.minimize, exact: true }).click();
  await page.getByRole('button', { name: fr.experience.review, exact: true }).click();
  await expect(page.getByRole('heading', { name: fr.debrief.title })).toBeVisible();
  await page.getByRole('button', { name: fr.debrief.backToSummary, exact: true }).click();
  await expect(page.getByText(fr.debrief.summary.hints(1), { exact: true })).toBeVisible();
});
