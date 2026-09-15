import { test, expect } from '@playwright/test';
import { fr } from '@shutteros/core/data/fr';
import { en } from '@shutteros/core/data/en';
import AxeBuilder from '@axe-core/playwright';

for (const [locale, copy] of [
  ['fr', fr],
  ['en', en],
] as const) {
  test(`learning highlights and stable disabled help in ${locale}`, async ({ page }) => {
    await page.goto(`./?lang=${locale}`);
    await page.getByLabel(copy.login.password, { exact: true }).fill('password');
    await page.getByRole('button', { name: copy.login.enter, exact: true }).click();
    await expect(page.locator('.intro-card mark')).toHaveText(copy.intro.principleEmphasis);
    await page.screenshot({ path: `test-results/previews/intro-${locale}.png` });
    await page.getByRole('button', { name: copy.intro.start, exact: true }).click();
    await page.locator('.desktop-icon:has([data-app="usb"])').click();
    const help = page.locator('.primary-help-slot .guidance-trigger');
    const position = await help.boundingBox();
    await page.locator('.file-sidebar-eject').click();
    await expect(help).toBeDisabled();
    expect(await help.boundingBox()).toEqual(position);
    await expect(page.locator('.learning-takeaway mark')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/previews/learning-${locale}.png` });
  });
}

test('visual cues shine once without shifting and respect reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('./');
  await page.getByLabel(fr.login.password, { exact: true }).fill('password');
  await page.getByRole('button', { name: fr.login.enter, exact: true }).click();
  const mark = page.locator('.intro-card mark');
  await expect(mark).toHaveCSS('animation-name', 'cue-shine');
  await expect(mark).toHaveCSS('animation-iteration-count', '1');
  const before = await mark.boundingBox();
  await mark.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  expect(await mark.boundingBox()).toEqual(before);
  await page.getByRole('button', { name: fr.intro.start, exact: true }).click();
  await page.locator('.desktop-icon:has([data-app="usb"])').click();
  await page.getByRole('button', { name: fr.guidance.first, exact: true }).click();
  const cues = page.locator('[data-hint-target="eject"], [data-hint-target="drive-label"]');
  for (const cue of await cues.all()) await expect(cue).toHaveCSS('animation-name', 'cue-shine');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const cue of await cues.all()) await expect(cue).toHaveCSS('animation-name', 'none');
  await expect(page.locator('[data-hint-target="eject"]')).toHaveCSS(
    'outline-color',
    'rgb(237, 186, 62)',
  );
});
