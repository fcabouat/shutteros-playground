import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fr } from '@shutteros/core/data/fr';
import { beginFree, switchToGuided } from './helpers';

async function enterAi(page: Page) {
  await page.goto('./');
  await beginFree(page);
  await page.getByLabel(fr.login.password, { exact: true }).fill('password');
  await page.getByRole('button', { name: fr.login.enter, exact: true }).click();
  await page.getByRole('button', { name: fr.intro.start, exact: true }).click();
  await page.locator('.desktop-icon:has([data-app="ai"])').click();
  await expect(page.locator('[data-challenge="ai"]')).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  const chat = page.locator('.ai-chat');
  expect(await chat.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
}

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`AI free chat and guided questionnaire stay reachable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await enterAi(page);

    const chat = page.locator('.ai-chat');
    const window = page.locator('.window-layer .os-window');
    const send = page.getByRole('button', { name: fr.ai.send, exact: true });
    const internal = page.getByRole('radio', { name: fr.ai.internal, exact: true });
    const commercial = page.getByRole('radio', { name: fr.ai.commercial, exact: true });
    const draft = page.getByRole('radio', { name: fr.ai.routineAnonymised, exact: true });

    await expect(chat).not.toHaveClass(/ai-questionnaire/);
    await expect(page.getByText(fr.ai.welcome, { exact: true })).toBeVisible();
    await expect(internal).toBeChecked();
    await expect(page.locator('.action-dock-panel')).toHaveCount(0);
    await expect(window).not.toHaveClass(/with-choices/);
    await expect(send).toBeDisabled();
    await commercial.check();
    await draft.check();
    await expect(page.locator('.ai-preview')).toHaveText(fr.ai.routineAnonymisedPrompt);
    if (viewport.width === 1366) await expect(send).toBeInViewport({ ratio: 1 });
    else {
      await send.focus();
      await expect(send).toBeFocused();
      await expect(send).toBeInViewport({ ratio: 0.99 });
    }
    await expectNoHorizontalOverflow(page, viewport.width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/previews/ai-free-${viewport.width}.png` });

    await switchToGuided(page);
    const confirm = page.getByRole('button', { name: fr.ai.confirm, exact: true });
    await expect(chat).toHaveClass(/ai-questionnaire/);
    await expect(page.getByText(fr.ai.welcome, { exact: true })).toHaveCount(0);
    await expect(page.locator('.action-dock-panel')).toHaveCount(0);
    await expect(window).not.toHaveClass(/with-choices/);
    await expect(commercial).toBeChecked();
    await expect(draft).toBeChecked();
    await expect(page.locator('.ai-prompt-detail')).toHaveCount(5);
    await expect(page.getByText(fr.ai.routineAnonymisedPrompt, { exact: true })).toBeVisible();
    if (viewport.width === 1366) await expect(confirm).toBeInViewport({ ratio: 1 });
    else {
      await confirm.focus();
      await expect(confirm).toBeFocused();
      await expect(confirm).toBeInViewport({ ratio: 0.99 });
    }
    await expectNoHorizontalOverflow(page, viewport.width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    if (viewport.width === 1366) {
      await window.getByRole('button', { name: fr.os.maximize, exact: true }).click();
      await expect(chat.locator('.ai-prompt').last()).toBeInViewport({ ratio: 1 });
      await expect(confirm).toBeInViewport({ ratio: 1 });
    }
    await page.screenshot({ path: `test-results/previews/ai-guided-${viewport.width}.png` });
  });
}
