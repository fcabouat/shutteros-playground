import { test, expect, type Page } from '@playwright/test';
import { fr } from '@shutteros/core/data/fr';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const portable = pathToFileURL(resolve('dist/portable/shutteros.html')).href;

async function enter(page: Page, delivery: 'http' | 'file') {
  await page.goto(delivery === 'http' ? './' : portable);
  await page.getByLabel(fr.login.password, { exact: true }).fill('password');
  await page.getByRole('button', { name: fr.login.enter, exact: true }).click();
  await page.getByRole('button', { name: fr.intro.start, exact: true }).click();
}

async function openStart(page: Page, id: string) {
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click();
  await page.locator(`.start-app:has([data-app="${id}"])`).click();
  await expect(page.locator(`[data-challenge="${id}"]`)).toBeVisible();
}

async function chooseFromGuidance(page: Page, choiceId: string) {
  const choices = page.locator('.choices-trigger');
  if (await choices.isDisabled()) {
    await page.locator('.activity-guidance .guidance-trigger').click();
  }
  await choices.click();
  await page.locator(`.action-dock-panel [data-choice="${choiceId}"]`).click();
}

for (const delivery of ['http', 'file'] as const) {
  test(`completed situations can be replayed without replacing the original result (${delivery})`, async ({
    page,
  }) => {
    await enter(page, delivery);
    const usbIcon = page.locator('.desktop-icon:has([data-app="usb"])');
    await usbIcon.click();
    const readme = page.getByRole('button', { name: fr.usb.readme });
    await readme.click();
    await expect(page.getByRole('note')).toContainText(fr.usb.readmeAdvisoryTitle);
    await page.getByRole('button', { name: fr.usb.closePreview }).click();
    await chooseFromGuidance(page, 'station');
    await expect(page.locator('.feedback-card[data-outcome="caution"]')).toContainText(
      fr.feedback.caution,
    );
    await page.getByRole('button', { name: 'Continuer l’exploration' }).click();

    await usbIcon.click();
    await page.locator('#usb-file-0').click();
    await expect(page.locator('.feedback-card[data-outcome="risky"]')).toBeVisible();
    await expect(page.getByText(fr.feedback.replay, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continuer l’exploration' }).click();
    await expect(page.locator('[data-challenge="incident"]')).toHaveCount(0);

    await openStart(page, 'web');
    await page.getByRole('button', { name: fr.web.submit, exact: true }).click();
    await expect(page.locator('.feedback-card[data-outcome="risky"]')).toBeVisible();
    await page.getByRole('button', { name: 'Continuer l’exploration' }).click();
    await openStart(page, 'web');
    await page.getByRole('button', { name: 'Réduire la fenêtre', exact: true }).click();
    await page.locator('[data-taskbar-window="web"]').click();
    await expect(page.locator('[data-challenge="web"]')).toBeVisible();
    await page.getByRole('button', { name: fr.web.bookmark, exact: false }).click();
    await expect(page.locator('.feedback-card[data-outcome="safe"]')).toBeVisible();
    await expect(page.getByText(fr.feedback.replay, { exact: true })).toBeVisible();
  });
}
