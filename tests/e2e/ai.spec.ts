import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fr } from '@shutteros/core/data/fr';
import { en } from '@shutteros/core/data/en';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

for (const locale of ['fr', 'en'] as const) {
  for (const delivery of ['http', 'file'] as const) {
    test(`AI chat: ${locale}/${delivery} explores before submitting and resets drafts`, async ({
      page,
    }) => {
      const copy = locale === 'fr' ? fr : en;
      await page.goto(
        delivery === 'http' ? './' : pathToFileURL(resolve('dist/portable/shutteros.html')).href,
      );
      if (locale === 'en') await page.getByRole('button', { name: 'EN', exact: true }).click();
      await page.getByLabel(copy.login.password, { exact: true }).fill('password');
      await page.getByRole('button', { name: copy.login.enter, exact: true }).click();
      await page.getByRole('button', { name: copy.intro.start, exact: true }).click();
      await page
        .locator('.desktop-icons')
        .getByRole('button', { name: copy.desktop.ai, exact: true })
        .dblclick();
      const scene = page.locator('[data-challenge="ai"]');
      await expect(scene).toBeVisible();
      await expect(page.locator('.action-dock')).toHaveCount(0);
      await page.getByRole('button', { name: copy.ai.policy, exact: true }).click();
      await expect(page.getByText(copy.ai.policyRules[0], { exact: true })).toBeVisible();
      await page.getByRole('button', { name: copy.ai.policy, exact: true }).click();
      await page.getByRole('radio', { name: copy.ai.commercial, exact: false }).check();
      await page.getByRole('button', { name: copy.ai.connect, exact: true }).click();
      await expect(page.getByRole('button', { name: copy.ai.send, exact: true })).toBeDisabled();
      await page.getByRole('radio', { name: copy.ai.masked, exact: true }).check();
      await expect(scene.locator('.ai-preview')).toHaveText(copy.ai.maskedPrompt);
      await expect(page.locator('.feedback-card')).toHaveCount(0);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({ path: `test-results/previews/ai-${locale}-${delivery}.png` });
      const outgoing: string[] = [];
      page.on('request', (request) => outgoing.push(request.url()));
      await page.getByRole('button', { name: copy.ai.send, exact: true }).click();
      await expect(
        page.getByText(copy.ai.feedback['commercial-masked'], { exact: true }),
      ).toBeVisible();
      expect(outgoing).toEqual([]);
      await page.getByRole('button', { name: copy.shell.logout, exact: true }).click();
      await page.getByRole('button', { name: copy.shell.exitConfirm, exact: true }).click();
      await page.getByLabel(copy.login.password, { exact: true }).fill('password');
      await page.getByRole('button', { name: copy.login.enter, exact: true }).click();
      await page.getByRole('button', { name: copy.intro.start, exact: true }).click();
      await page
        .locator('.desktop-icons')
        .getByRole('button', { name: copy.desktop.ai, exact: true })
        .dblclick();
      await expect(page.getByRole('radio', { name: copy.ai.internal, exact: false })).toBeChecked();
      await page.getByRole('button', { name: copy.ai.connect, exact: true }).click();
      await expect(page.getByRole('button', { name: copy.ai.send, exact: true })).toBeDisabled();
      await page.getByRole('radio', { name: copy.ai.generic, exact: true }).check();
      await page.getByRole('button', { name: copy.ai.send, exact: true }).click();
      await expect(page.locator('.feedback-card[data-outcome="safe"]')).toContainText(
        copy.ai.feedback['internal-generic'],
      );
    });
  }
}
