import { test, expect } from '@playwright/test';
import { en } from '@shutteros/core/data/en';
import { fr } from '@shutteros/core/data/fr';

for (const locale of ['fr', 'en'] as const) {
  const catalog = locale === 'fr' ? fr : en;
  const copy = {
    show: catalog.login.showPassword,
    hide: catalog.login.hidePassword,
    password: catalog.login.password,
  };

  test(`login phrase masking keeps its value in ${locale}`, async ({ page }) => {
    await page.goto(`./?lang=${locale}`);
    const input = page.getByLabel(copy.password, { exact: true });
    const show = page.getByRole('button', { name: copy.show, exact: true });
    const hide = page.getByRole('button', { name: copy.hide, exact: true });

    await expect(input).toHaveAttribute('autocomplete', 'off');
    await expect(show).toBeVisible();
    const supportsTextSecurity = await page.evaluate(() =>
      CSS.supports('-webkit-text-security', 'disc'),
    );
    if (supportsTextSecurity) {
      await expect(input).toHaveClass(/minimal-secret-mask/);
    } else {
      await expect(input).toHaveAttribute('type', 'password');
    }
    await input.fill('fictional phrase');
    await show.click();
    await expect(input).toHaveValue('fictional phrase');
    await expect(hide).toBeVisible();
    await hide.click();
    await expect(input).toHaveValue('fictional phrase');
    await expect(show).toBeVisible();
  });

  test(`login phrase resets masking after Enter submission in ${locale}`, async ({ page }) => {
    await page.goto(`./?lang=${locale}`);
    const input = page.getByLabel(copy.password, { exact: true });
    await input.fill('wrong phrase');
    await page.getByRole('button', { name: copy.show, exact: true }).click();
    await input.press('Enter');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(input).toHaveValue('');
    await expect(page.getByRole('button', { name: copy.show, exact: true })).toBeVisible();

    await input.fill('PASSWORD');
    await page.getByRole('button', { name: copy.show, exact: true }).click();
    await input.press('Enter');
    await expect(
      page.getByRole('heading', { name: catalog.intro.title, exact: true }),
    ).toBeVisible();
  });
}

test('login masking falls back to a password input when text security is unavailable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(CSS, 'supports', { value: () => false, configurable: true });
  });
  await page.goto('./?lang=en');
  const input = page.getByLabel('Password', { exact: true });
  await expect(input).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(input).toHaveAttribute('type', 'text');
});
