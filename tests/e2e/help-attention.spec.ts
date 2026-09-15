import { test, expect, type Page } from '@playwright/test';
import { fr } from '@shutteros/core/data/fr';
import { guidanceDelayMs } from '@shutteros/core/model/game';

async function enter(page: Page) {
  await page.clock.install();
  await page.goto('./');
  await page.getByLabel(fr.login.password, { exact: true }).fill('password');
  await page.getByRole('button', { name: fr.login.enter, exact: true }).click();
  await page.getByRole('button', { name: fr.intro.start, exact: true }).click();
}

test('desktop help draws attention after waiting without moving the click target', async ({
  page,
}) => {
  await enter(page);
  const help = page.locator('.companion-trigger');
  const position = await help.boundingBox();
  await page.clock.fastForward(guidanceDelayMs - 1_000);
  await expect(help).not.toHaveClass(/help-attention/);
  await page.clock.fastForward(1_100);
  await expect(help).toHaveClass(/help-attention/);
  expect(await help.boundingBox()).toEqual(position);
  await expect(help.locator('.help-cue')).toHaveCSS('animation-iteration-count', '3');
  await expect(help.locator('.help-cue')).toHaveCSS('animation-duration', '0.7s');
  await page.screenshot({ path: 'test-results/previews/help-nudge.png' });
  await help.click();
  await page.getByRole('button', { name: fr.guide.dismiss, exact: true }).click();
  await expect(help).not.toHaveClass(/help-attention/);
  await page.clock.fastForward(1_100);
  await expect(help).not.toHaveClass(/help-attention/);
});

test('both automatic assistance controls receive a nudge; using each control acknowledges it', async ({
  page,
}) => {
  await enter(page);
  await page.locator('.desktop-icon:has([data-app="usb"])').click();
  const hint = page.locator('.primary-help-slot .guidance-trigger');
  const choices = page.locator('.choices-trigger');
  await expect(hint).not.toHaveClass(/help-attention/);
  await expect(choices).not.toHaveClass(/help-attention/);
  await page.clock.fastForward(guidanceDelayMs + 100);
  await expect(hint).toHaveAttribute('data-attention', '1');
  await expect(hint).toHaveClass(/help-attention/);
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);
  await hint.click();
  await page.clock.fastForward(1_100);
  await expect(hint).not.toHaveClass(/help-attention/);
  await page.clock.fastForward(guidanceDelayMs + 100);
  await expect(hint).not.toHaveClass(/help-attention/);
  await expect(choices).toHaveAttribute('data-attention', '2');
  await expect(choices).toHaveClass(/help-attention/);
  await expect(page.locator('.action-dock-panel')).toBeVisible();
  await expect(hint).toHaveText(fr.guidance.restore);
  await choices.click();
  await page.clock.fastForward(1_100);
  await expect(choices).not.toHaveClass(/help-attention/);
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);
});

test('manual hints stay calm and reduced motion keeps a static attention marker', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page);
  await page.clock.fastForward(guidanceDelayMs + 100);
  await expect(page.locator('.companion-trigger')).toHaveClass(/help-attention/);
  await expect(page.locator('.companion-trigger .help-cue')).toHaveCSS('animation-name', 'none');
  await page.locator('.desktop-icon:has([data-app="usb"])').click();
  const help = page.locator('.primary-help-slot .guidance-trigger');
  await help.click();
  await expect(help).not.toHaveClass(/help-attention/);
  await expect(help).toHaveText(fr.challenge.hideHint);
  await help.click();
  await expect(help).not.toHaveClass(/help-attention/);
  await expect(help).toHaveText(fr.guidance.restore);
  await page.locator('.choices-trigger').click();
  await expect(page.locator('.action-dock-panel')).toBeVisible();
});
