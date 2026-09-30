import { expect, type Page } from '@playwright/test';
import { en } from '@shutteros/core/data/en';
import { fr } from '@shutteros/core/data/fr';

export async function beginFree(page: Page, locale: 'fr' | 'en' = 'fr') {
  const copy = locale === 'fr' ? fr : en;
  const freeMode = page.getByRole('radio', { name: copy.welcome.free.title });
  await expect(freeMode).toBeVisible();
  await freeMode.click();
  await page.getByRole('button', { name: copy.welcome.begin, exact: true }).click();
}
