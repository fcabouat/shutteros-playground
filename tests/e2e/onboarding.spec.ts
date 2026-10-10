import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { fr } from '@shutteros/core/data/fr';
import { en } from '@shutteros/core/data/en';
import config from '../../static/kiosk-config.json' with { type: 'json' };
import { beginGuided } from './helpers';

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
      await expect(page.getByRole('radio').nth(0)).toHaveAttribute('value', 'guided');
      await expect(page.getByRole('radio').nth(1)).toHaveAttribute('value', 'free');
      await expect(page.getByRole('radio', { name: copy.welcome.guided.title })).toBeChecked();
      await expect(page.locator('.os-topbar')).toBeVisible();
      await expect(page.getByText(copy.welcome.switchTitle, { exact: true })).toBeVisible();
      await expect(page.locator('.welcome-hero')).toBeVisible();
      expect(
        await page
          .locator('.welcome-hero')
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      ).toBeGreaterThan(0);
      await expect(
        page.getByRole('button', { name: copy.welcome.controls.progress, exact: true }),
      ).toBeDisabled();
      const modeSwitch = page.locator('.onboarding-controls .finish-experience');
      await expect(modeSwitch).toBeEnabled();
      await modeSwitch.click();
      await expect(page.getByRole('radio', { name: copy.welcome.free.title })).toBeChecked();
      await page.getByRole('radio', { name: copy.welcome.guided.title }).check();
      await expect(modeSwitch).toHaveText(copy.experience.free);
      const welcomeHint = page.locator('.onboarding-controls button[aria-pressed]');
      await welcomeHint.click();
      const hintWindow = page.getByRole('dialog', { name: copy.shell.guide });
      await expect(hintWindow).toContainText(copy.welcome.hint);
      await page.keyboard.press('Escape');
      await expect(hintWindow).toBeHidden();
      await expect(welcomeHint).toBeFocused();
      await expect(welcomeHint).toHaveText(copy.guidance.restore);
      await welcomeHint.click();
      await hintWindow.getByRole('button', { name: copy.guidance.minimize, exact: true }).click();
      await expect(hintWindow).toBeHidden();
      await expect(page.getByRole('heading', { name: copy.welcome.title })).toBeVisible();
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
          name: copy.login.guidedChoices[0].label,
          exact: true,
        }),
      ).toBeFocused();
      await expect(page.getByLabel(copy.login.password, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: copy.login.enter, exact: true })).toBeVisible();
      if (delivery === 'http')
        await page.screenshot({
          path: `test-results/previews/login-side-quiz-${locale}.png`,
          fullPage: true,
        });
      const controlsAfter = await page.locator('.session-controls').boundingBox();
      expect(controlsAfter?.y).toBe(controlsBefore?.y);
      await page.clock.fastForward(31 * 60_000);
      await expect(page.getByRole('group', { name: copy.login.guidedQuestion })).toBeVisible();
      await page
        .getByRole('button', {
          name: copy.login.guidedChoices[0].label,
          exact: true,
        })
        .click();
      await expect(page.getByRole('heading', { name: copy.intro.guidedTitle })).toBeVisible();
      await expect(
        page.getByText(copy.intro.managerUnlock(config.passwordManagerName), { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(copy.intro.keepassxcCertification, { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(copy.intro.keepassdx, { exact: true })).toBeVisible();
      if (delivery === 'http') {
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await page.screenshot({
          path: `test-results/previews/guided-login-feedback-${locale}.png`,
        });
      }
      // The live clock keeps running during the accessibility scan and screenshot.
      await expect(page.locator('.session-timer')).toContainText(/30:00|29:5\d/);
      await expect(page.getByRole('heading', { name: copy.intro.title, exact: true })).toHaveCount(
        0,
      );
      await page.getByRole('button', { name: copy.intro.guidedStart, exact: true }).click();
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

test('guided storage choices keep option text generic and scope the configured manager to explanations', async ({
  page,
}) => {
  const manager = 'KeePassDX';
  await page.route('**/kiosk-config.json', (route) =>
    route.fulfill({ json: { ...config, passwordManagerName: manager } }),
  );
  for (const choice of fr.login.guidedChoices) {
    await page.goto('./');
    await beginGuided(page);
    await expect(page.getByRole('group', { name: fr.login.guidedQuestion })).not.toContainText(
      manager,
    );
    await page.getByRole('button', { name: choice.label, exact: true }).click();
    await expect(
      page.getByRole('heading', {
        name: choice.id === 'manager' ? fr.intro.guidedTitle : fr.intro.guidedRiskTitle,
      }),
    ).toBeVisible();
    await expect(page.locator('.intro-card')).toContainText(manager);
    await expect(page.getByText(fr.intro.keepassdx, { exact: true })).toBeVisible();
    await expect(page.getByText(fr.intro.keepassxcCertification, { exact: true })).toHaveCount(0);
    const review = page.locator('.login-decision-review');
    await expect(review.locator(`[data-choice="${choice.id}"]`)).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(review.locator(`[data-choice="${choice.id}"]`)).toContainText(
      fr.feedback.selected,
    );
    await expect(review.locator('[data-choice="manager"]')).toHaveAttribute(
      'data-outcome',
      'correct',
    );
    await expect(review.locator('[data-choice="manager"]')).toContainText(fr.feedback.correct);
    for (const risky of ['note', 'file']) {
      await expect(review.locator(`[data-choice="${risky}"]`)).toHaveAttribute(
        'data-outcome',
        'incorrect',
      );
      await expect(review.locator(`[data-choice="${risky}"]`)).toContainText(fr.feedback.incorrect);
    }
    if (choice.id !== 'manager')
      await expect(review.locator('[data-choice="manager"]')).toContainText(
        fr.feedback.alternative,
      );
    await page.getByRole('button', { name: fr.intro.guidedStart, exact: true }).click();
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
  const manager = 'KeePassDX';
  await page.route('**/kiosk-config.json', (route) =>
    route.fulfill({ json: { ...config, passwordManagerName: manager } }),
  );
  await page.goto('./');
  await beginGuided(page);
  await page
    .getByRole('button', {
      name: fr.login.guidedChoices[0].label,
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: fr.intro.guidedStart, exact: true }).click();
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
  await chat.getByRole('radio', { name: fr.ai.generic, exact: true }).check();
  await chat.getByRole('button', { name: fr.ai.confirm, exact: true }).click();
  await page.getByRole('button', { name: fr.experience.next, exact: true }).click();
  await page.screenshot({ path: 'test-results/previews/guided-routines.png' });
  await page
    .getByRole('button', {
      name: fr.routines.passwordAction,
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: fr.routines.updateAction, exact: true }).click();
  await page.getByRole('button', { name: fr.routines.lockAction, exact: true }).click();
  await page.getByRole('button', { name: fr.routines.unlock, exact: true }).click();
  await page.getByRole('button', { name: fr.experience.review, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: fr.debrief.summary.title(config.playerName, true) }),
  ).toBeVisible();
  await expect(page.getByText(fr.debrief.summary.hints(1, 8), { exact: true })).toBeVisible();
  await expect(page.getByText(fr.debrief.summary.modes.mixed, { exact: true })).toBeVisible();
  await expect(page.getByText(fr.debrief.summary.situations(7, 7), { exact: true })).toBeVisible();
  await expect(page.getByText(fr.debrief.summary.habits(3, 3), { exact: true })).toBeVisible();
  await expect(page.locator('.summary-fact').first()).toContainText(fr.debrief.summary.journey);
  await expect(page.getByRole('button', { name: fr.shell.nextPlayer, exact: true })).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.summary-fact').first()).toHaveCSS('animation-name', 'none');
  await page.screenshot({ path: 'test-results/previews/journey-summary.png' });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: fr.debrief.summary.detailed, exact: true }).click();
  await expect(page.getByRole('heading', { name: fr.debrief.title })).toBeVisible();
  await expect(page.getByRole('heading', { name: fr.debrief.title })).toBeFocused();
  await expect(page.getByText(fr.debrief.passwordNote(manager), { exact: true })).toBeVisible();
  await expect(page.getByText(fr.debrief.source, { exact: true })).toBeVisible();
  await expect(page.getByText(fr.debrief.privacy, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: fr.os.minimize, exact: true }).click();
  await page.getByRole('button', { name: fr.experience.review, exact: true }).click();
  await expect(page.getByRole('heading', { name: fr.debrief.title })).toBeVisible();
  await page.getByRole('button', { name: fr.debrief.backToSummary, exact: true }).click();
  await expect(page.getByText(fr.debrief.summary.hints(1, 8), { exact: true })).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`game bar controls keep consistent geometry before and after login at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('./');
    const checkControls = async () => {
      const controls = page.locator('.session-help button, .session-finish button, .session-timer');
      await expect(controls).toHaveCount(4);
      const geometry = await controls.evaluateAll((elements) =>
        elements.map((element) => {
          const style = getComputedStyle(element);
          const icon = element.querySelector('svg')!.getBoundingClientRect();
          return {
            height: element.getBoundingClientRect().height,
            radius: style.borderRadius,
            padding: style.paddingInline,
            gap: style.gap,
            font: style.fontSize,
            iconWidth: icon.width,
            iconHeight: icon.height,
          };
        }),
      );
      expect(geometry[0]!.height).toBe(52);
      expect(geometry[0]!.radius).toBe('6px');
      const insets = await page.locator('.os-topbar').evaluate((bar) => {
        const bounds = bar.getBoundingClientRect();
        const controls = bar.querySelector('.session-controls')!.getBoundingClientRect();
        return { top: controls.top - bounds.top, bottom: bounds.bottom - controls.bottom };
      });
      expect(insets.bottom).toBe(6);
      if (width === 1440) expect(insets.top).toBe(6);
      for (const control of geometry) expect(control).toEqual(geometry[0]);
      expect(
        await page
          .locator('.session-help')
          .evaluate((element) => getComputedStyle(element).columnGap),
      ).toBe(
        await page
          .locator('.session-controls')
          .evaluate((element) => getComputedStyle(element).columnGap),
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    };
    await checkControls();
    await beginGuided(page);
    await page.getByRole('button', { name: fr.login.guidedChoices[0].label, exact: true }).click();
    await page.getByRole('button', { name: fr.intro.guidedStart, exact: true }).click();
    await checkControls();
    await page.locator('.finish-experience').click();
    await checkControls();
    await page.screenshot({ path: `test-results/previews/unified-controls-${width}.png` });
  });
}

test('easy mode also allows signing in directly and preserves a draft across mode changes', async ({
  page,
}) => {
  await page.goto('./');
  await beginGuided(page);
  const password = page.getByLabel(fr.login.password, { exact: true });
  await password.fill(config.acceptedPasswords[0]!);
  await page.locator('.finish-experience').click();
  await expect(password).toHaveValue(config.acceptedPasswords[0]!);
  await expect(page.locator('.guided-login')).toHaveCount(0);
  await page.locator('.finish-experience').click();
  await expect(password).toHaveValue(config.acceptedPasswords[0]!);
  await page.getByRole('button', { name: fr.login.enter, exact: true }).click();
  await expect(page.getByRole('heading', { name: fr.intro.title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: fr.intro.guidedStart, exact: true }).click();
  await expect(page.locator('.action-dock-panel')).toBeVisible();
  await expect(page.locator('.window-layer .os-window')).not.toHaveClass(/maximized/);
});
