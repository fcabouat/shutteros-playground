import { expect, type Page } from '@playwright/test';
import { en } from '@shutteros/core/data/en';
import { fr } from '@shutteros/core/data/fr';

export async function beginFree(page: Page, locale: 'fr' | 'en' = 'fr') {
  const copy = locale === 'fr' ? fr : en;
  const freeMode = page.getByRole('radio', { name: copy.welcome.free.title });
  await expect(freeMode).toBeVisible();
  await expect(freeMode).toBeChecked();
  await page.getByRole('button', { name: copy.welcome.begin, exact: true }).click();
}

export async function beginGuided(page: Page, locale: 'fr' | 'en' = 'fr') {
  const copy = locale === 'fr' ? fr : en;
  await page.getByRole('radio', { name: copy.welcome.guided.title }).click();
  await page.getByRole('button', { name: copy.welcome.begin, exact: true }).click();
}

export async function switchToGuided(page: Page, locale: 'fr' | 'en' = 'fr') {
  const copy = locale === 'fr' ? fr : en;
  await page.getByRole('button', { name: copy.experience.guided, exact: true }).first().click();
}

export async function switchToFree(page: Page, locale: 'fr' | 'en' = 'fr') {
  const copy = locale === 'fr' ? fr : en;
  await page.getByRole('button', { name: copy.experience.free, exact: true }).first().click();
}
