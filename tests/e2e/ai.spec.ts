import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fr } from '@shutteros/core/data/fr';
import { en } from '@shutteros/core/data/en';
import { challenges } from '@shutteros/core/data/challenges';
import { englishChallenges } from '@shutteros/core/data/challenges.en';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

async function openAiFromDesktop(page: import('@playwright/test').Page) {
  await page.locator('.desktop-icon:has([data-app="ai"])').click();
}

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
      await openAiFromDesktop(page);
      const scene = page.locator('[data-challenge="ai"]');
      await expect(scene).toBeVisible();
      await expect(page.locator('.action-dock')).toBeHidden();
      await page.getByRole('button', { name: copy.ai.policy, exact: true }).click();
      await expect(page.getByText(copy.ai.policyRules[0], { exact: true })).toBeVisible();
      await page.getByRole('button', { name: copy.ai.policy, exact: true }).click();
      await page.getByRole('radio', { name: copy.ai.commercial, exact: false }).check();
      await page.getByRole('button', { name: copy.ai.connect, exact: true }).click();
      await expect(page.getByRole('button', { name: copy.ai.send, exact: true })).toBeDisabled();
      await page.getByRole('radio', { name: copy.ai.routine, exact: true }).check();
      await expect(scene.locator('.ai-preview')).toHaveText(copy.ai.routinePrompt);
      await expect(page.locator('.feedback-card')).toHaveCount(0);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({ path: `test-results/previews/ai-${locale}-${delivery}.png` });
      const outgoing: string[] = [];
      page.on('request', (request) => outgoing.push(request.url()));
      await page.getByRole('button', { name: copy.ai.send, exact: true }).click();
      await expect(
        page.getByText(copy.ai.feedback['commercial-routine'], { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText((locale === 'fr' ? challenges : englishChallenges).ai.lesson, {
          exact: true,
        }),
      ).toBeVisible();
      const review = page.locator('.decision-review[data-activity="ai"]');
      for (const label of Object.values(copy.ai.review)) await expect(review).toContainText(label);
      await expect(review.locator('[data-choice="commercial-routine"]')).toContainText(
        copy.ai.otherTool.internal,
      );
      await expect(review.locator('.decision-review-tool-note')).toHaveCount(1);
      expect(outgoing).toEqual([]);
      await page.getByRole('button', { name: copy.shell.logout, exact: true }).click();
      await page.getByRole('button', { name: copy.shell.exitConfirm, exact: true }).click();
      await page.getByLabel(copy.login.password, { exact: true }).fill('password');
      await page.getByRole('button', { name: copy.login.enter, exact: true }).click();
      await page.getByRole('button', { name: copy.intro.start, exact: true }).click();
      await openAiFromDesktop(page);
      await expect(page.getByRole('radio', { name: copy.ai.internal, exact: false })).toBeChecked();
      await page.getByRole('button', { name: copy.ai.connect, exact: true }).click();
      await expect(page.getByRole('button', { name: copy.ai.send, exact: true })).toBeDisabled();
      await page.getByRole('radio', { name: copy.ai.routine, exact: true }).check();
      await page.getByRole('button', { name: copy.ai.send, exact: true }).click();
      await expect(page.locator('.feedback-card[data-outcome="safe"]')).toContainText(
        copy.ai.feedback['internal-routine'],
      );
      await expect(
        page.getByText((locale === 'fr' ? challenges : englishChallenges).ai.lesson, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(review.locator('.decision-review-security')).toHaveCount(2);
      await expect(review.locator('.decision-review-security').first()).toHaveText(
        copy.ai.securityMarker,
      );

      await expect(review.locator('[data-choice="internal-routine"]')).toContainText(
        copy.ai.otherTool.commercial,
      );
      await expect(review.locator('.decision-review-tool-note')).toHaveCount(1);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({ path: `test-results/previews/ai-review-${locale}-${delivery}.png` });

      await page.getByRole('button', { name: copy.feedback.continue, exact: true }).click();
      await openAiFromDesktop(page);
      await page.getByRole('button', { name: copy.ai.connect, exact: true }).click();
      await page.getByRole('radio', { name: copy.ai.confidential, exact: true }).check();
      await expect(page.locator('[data-challenge="ai"] .ai-preview')).toHaveText(
        copy.ai.confidentialPrompt,
      );
      await page.screenshot({
        path: `test-results/previews/ai-${locale}-${delivery}-confidential.png`,
      });
      await page.getByRole('button', { name: copy.ai.send, exact: true }).click();
      await expect(page.locator('.feedback-card[data-outcome="risky"]')).toContainText(
        copy.ai.feedback['internal-confidential'],
      );
      await expect(
        page.getByText((locale === 'fr' ? challenges : englishChallenges).ai.lesson, {
          exact: true,
        }),
      ).toBeVisible();

      const replayCases = [
        {
          tool: copy.ai.internal,
          prompt: copy.ai.routineAnonymised,
          feedback: 'internal-routineAnonymised',
          outcome: 'safe',
        },
        {
          tool: copy.ai.commercial,
          prompt: copy.ai.routineAnonymised,
          feedback: 'commercial-routineAnonymised',
          outcome: 'safe',
        },
        {
          tool: copy.ai.internal,
          prompt: copy.ai.generic,
          feedback: 'internal-generic',
          outcome: 'safe',
        },
        {
          tool: copy.ai.commercial,
          prompt: copy.ai.generic,
          feedback: 'commercial-generic',
          outcome: 'safe',
        },
        {
          tool: copy.ai.internal,
          prompt: copy.ai.confidentialAnonymised,
          feedback: 'internal-confidentialAnonymised',
          outcome: 'risky',
        },
        {
          tool: copy.ai.commercial,
          prompt: copy.ai.confidential,
          feedback: 'commercial-confidential',
          outcome: 'risky',
        },
        {
          tool: copy.ai.commercial,
          prompt: copy.ai.confidentialAnonymised,
          feedback: 'commercial-confidentialAnonymised',
          outcome: 'risky',
        },
      ] as const;
      for (const replay of replayCases) {
        await page.getByRole('button', { name: copy.feedback.continue, exact: true }).click();
        await openAiFromDesktop(page);
        await page.getByRole('radio', { name: replay.tool, exact: false }).check();
        await page.getByRole('button', { name: copy.ai.connect, exact: true }).click();
        await page.getByRole('radio', { name: replay.prompt, exact: true }).check();
        await page.getByRole('button', { name: copy.ai.send, exact: true }).click();
        await expect(
          page.locator(`.feedback-card[data-outcome="${replay.outcome}"]`),
        ).toContainText(copy.ai.feedback[replay.feedback]);
        await expect(
          page.getByText((locale === 'fr' ? challenges : englishChallenges).ai.lesson, {
            exact: true,
          }),
        ).toBeVisible();
      }

      await page.getByRole('button', { name: copy.shell.logout, exact: true }).click();
      await page.getByRole('button', { name: copy.shell.exitConfirm, exact: true }).click();
      await page.getByLabel(copy.login.password, { exact: true }).fill('password');
      await page.getByRole('button', { name: copy.login.enter, exact: true }).click();
      await page.getByRole('button', { name: copy.intro.start, exact: true }).click();
      await page
        .locator('.desktop-icons')
        .getByRole('button', { name: copy.desktop.ai, exact: true })
        .click();
      await page.getByRole('radio', { name: copy.ai.commercial, exact: false }).check();
      await page.getByRole('button', { name: copy.ai.connect, exact: true }).click();
      await page.getByRole('radio', { name: copy.ai.generic, exact: true }).check();
      await page.getByRole('button', { name: copy.ai.send, exact: true }).click();
      await expect(page.locator('.feedback-card[data-outcome="safe"]')).toContainText(
        copy.ai.feedback['commercial-generic'],
      );
      await expect(
        page.getByText((locale === 'fr' ? challenges : englishChallenges).ai.lesson, {
          exact: true,
        }),
      ).toBeVisible();
    });
  }
}
