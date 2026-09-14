import { test, expect, type Page } from '@playwright/test';
import { fr } from '@shutteros/core/data/fr';
import { guidanceDelayMs } from '@shutteros/core/model/game';
import { activityDefinition } from '@shutteros/core/data/activities';

async function enter(page: Page) {
  await page.goto('./');
  await page.getByLabel(fr.login.password, { exact: true }).fill('password');
  await page.getByRole('button', { name: fr.login.enter, exact: true }).click();
  await page.getByRole('button', { name: fr.intro.start, exact: true }).click();
}

async function open(page: Page, id: 'usb' | 'incident' | 'mail' | 'web' | 'mfa' | 'ai') {
  await page.locator(`.desktop-icon:has([data-app="${id}"])`).dblclick();
  await expect(page.locator(`[data-challenge="${id}"]`)).toBeVisible();
}

async function choices(page: Page) {
  await page.getByRole('button', { name: fr.guidance.first, exact: true }).click();
  await page.getByRole('button', { name: fr.guidance.second, exact: true }).click();
  await expect(page.locator('.action-dock-panel')).toBeVisible();
}

async function advance(page: Page) {
  await page.getByRole('button', { name: fr.feedback.continue, exact: true }).click();
}

function expectSeparated(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) {
  const overlapX =
    Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);
  const overlapY =
    Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y);
  expect(overlapX <= 1 || overlapY <= 1).toBeTruthy();
}

test('untouched login waits; first input starts the two-minute hint without starting the session deadline', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('./');
  await expect(page.getByLabel(fr.login.password, { exact: true })).toBeVisible();
  await page.clock.fastForward(20 * 60_000);
  await expect(page.locator('#password-help')).toHaveCount(0);
  await page.getByLabel(fr.login.password, { exact: true }).fill('guess');
  await page.clock.fastForward(guidanceDelayMs - 1_000);
  await expect(page.locator('#password-help')).toHaveCount(0);
  await page.clock.fastForward(1_100);
  await expect(page.locator('#password-help')).toBeVisible();
  await expect(page.locator('[role="timer"]')).toHaveCount(0);
});

test('manual hints highlight a native control, then expose equivalent choices and their selected feedback', async ({
  page,
}) => {
  await enter(page);
  await open(page, 'usb');
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);
  await page.getByRole('button', { name: fr.guidance.first, exact: true }).click();
  const target = activityDefinition('usb').steps.choose.firstHintTarget;
  await expect(page.locator(`[data-hint-target="${target}"]`).first()).toHaveCSS(
    'outline-width',
    '3px',
  );
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);
  await page.getByRole('button', { name: fr.guidance.second, exact: true }).click();
  await page.locator('.action-dock-panel [data-choice="eject"]').click();
  const review = page.locator('.decision-review');
  await expect(review.locator('[data-choice="eject"]')).toHaveAttribute('aria-current', 'true');
  await expect(review.locator('[data-choice="eject"]')).toContainText(fr.feedback.correct);
  await expect(review.locator('[data-choice="station"]')).toContainText(fr.feedback.alternative);
  await expect(review.locator('[data-choice="open"]')).toContainText(fr.feedback.incorrect);
  await expect(review.getByRole('button')).toHaveCount(0);
});

test('repeated clicks cannot postpone automatic help; closing and reopening preserves it', async ({
  page,
}) => {
  await page.clock.install();
  await enter(page);
  await open(page, 'usb');
  await page.clock.fastForward(60_000);
  await page.locator('#usb-file-2').click();
  await page.clock.fastForward(60_100);
  await expect(page.getByRole('button', { name: fr.guidance.second, exact: true })).toBeVisible();
  await page.getByRole('button', { name: fr.shell.close, exact: true }).click();
  await page.clock.fastForward(60_000);
  await open(page, 'usb');
  await expect(page.getByRole('button', { name: fr.guidance.second, exact: true })).toBeVisible();
  await page.clock.fastForward(118_000);
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);
  await page.locator('#usb-file-1').click();
  await page.clock.fastForward(2_100);
  await expect(page.locator('.action-dock-panel')).toBeVisible();
});

test('minimizing pauses assistance, restoring resumes it, and notifications never interrupt the activity', async ({
  page,
}) => {
  await page.clock.install();
  await enter(page);
  await open(page, 'web');
  await page.clock.fastForward(60_000);
  await page.getByRole('button', { name: fr.os.minimize, exact: true }).click();
  await page.clock.fastForward(180_000);
  await page
    .getByRole('button', { name: `${fr.os.openApp} ${fr.desktop.web}`, exact: true })
    .click();
  await expect(page.getByRole('button', { name: fr.guidance.first, exact: true })).toBeVisible();
  await expect(page.locator('.action-dock-panel, .ambient-notice')).toHaveCount(0);
  await page.clock.fastForward(60_100);
  await expect(page.getByRole('button', { name: fr.guidance.second, exact: true })).toBeVisible();
  await expect(page.locator('.ambient-notice')).toHaveCount(0);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 960, height: 720 },
]) {
  test(`expanded guidance has its own space at ${viewport.width}px, including a maximized window`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await enter(page);
    await open(page, 'web');
    await page.getByRole('button', { name: fr.os.maximize, exact: true }).click();
    await choices(page);
    const frame = await page.locator('.os-window').boundingBox();
    const guide = await page.locator('.activity-guidance').boundingBox();
    const panel = await page.locator('.action-dock-panel').boundingBox();
    expect(frame && guide && panel).toBeTruthy();
    expectSeparated(frame!, guide!);
    expectSeparated(frame!, panel!);
    await expect(page.getByRole('button', { name: fr.guidance.close, exact: true })).toBeInViewport(
      { ratio: 1 },
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  });
}

test('readme opens an editor; ZIP is a risky action; direct eject has the same reviewed result', async ({
  page,
}) => {
  await enter(page);
  await open(page, 'usb');
  await page.locator('#usb-file-2').dblclick();
  await expect(page.getByRole('dialog', { name: fr.usb.readme, exact: true })).toBeVisible();
  await expect(page.locator('.text-editor-document')).toHaveText(fr.usb.readmePreview);
  await expect(page.locator('.feedback-card')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#usb-file-2')).toBeFocused();
  await page.locator('#usb-file-1').dblclick();
  await expect(page.locator('.feedback-card')).toHaveAttribute('data-outcome', 'risky');
  await expect(page.locator('.decision-review [data-choice="archive"]')).toHaveAttribute(
    'aria-current',
    'true',
  );
  await page.getByRole('button', { name: fr.feedback.incident, exact: true }).click();
  await page.getByRole('button', { name: fr.shell.close, exact: true }).click();
  await open(page, 'usb');
  await page.locator('.file-sidebar-eject').click();
  await expect(page.locator('.decision-review [data-choice="eject"]')).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(page.locator('.feedback-card')).toContainText(fr.feedback.replay);
});

test('both emails use the same report action, in either order, without requiring sender inspection', async ({
  page,
}) => {
  await enter(page);
  await open(page, 'mail');
  await expect(page.locator('.mail-list-message')).toHaveCount(2);
  await expect(page.getByRole('button', { name: fr.routines.account, exact: true })).toHaveCount(0);
  await page.locator('.mail-list-message').nth(1).click();
  await expect(page.locator('[data-challenge="spoof"]')).toBeVisible();
  await page.locator('[data-hint-target="report"]').click();
  await expect(page.locator('.decision-review [data-choice="report"]')).toHaveAttribute(
    'aria-current',
    'true',
  );
  await advance(page);
  await expect(page.locator('[data-challenge="mail"]')).toBeVisible();
  await page.locator('[data-hint-target="report"]').click();
  await expect(page.locator('.decision-review [data-choice="report"]')).toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('a routine completed from Start suppresses its later reminder and is clearly identified', async ({
  page,
}) => {
  await page.clock.install();
  await enter(page);
  await page.getByRole('button', { name: fr.os.start, exact: true }).click();
  await page.getByRole('button', { name: fr.routines.account, exact: true }).click();
  await expect(page.locator('.window-titlebar .activity-family')).toHaveText(
    fr.guidance.families.protection,
  );
  await page.getByRole('button', { name: fr.routines.passwordAction, exact: true }).click();
  await page.clock.fastForward(90_100);
  await expect(page.locator('.ambient-notice')).toHaveCount(0);
  await page.getByRole('button', { name: fr.shell.close, exact: true }).click();
  await expect(
    page.locator('.ambient-notice').filter({ hasText: fr.routines.password }),
  ).toHaveCount(0);
});

test('the optional quiz uses the same explicit correct and incorrect feedback as native actions', async ({
  page,
}) => {
  await enter(page);
  await open(page, 'mfa');
  await page.locator('[data-hint-target="deny-report"]').click();
  await page.getByRole('button', { name: fr.routines.check, exact: true }).click();
  const check = page.locator('[data-knowledge="mfa"]');
  const selected = check.locator('[data-choice="share-code"]');
  await selected.click();
  await expect(selected).toHaveAttribute('data-outcome', 'incorrect');
  await expect(selected).toContainText(fr.feedback.incorrect);
  await expect(selected).toContainText(fr.feedback.selected);
  await expect(selected).toBeDisabled();
  const alternative = check.locator('[data-choice="never-share"]');
  await expect(alternative).toHaveAttribute('data-outcome', 'correct');
  await expect(alternative).toContainText(fr.feedback.correct);
  await expect(alternative).toContainText(fr.feedback.alternative);
});

test('manual second hint moves keyboard focus to its choices and keeps an AI draft across hiding', async ({
  page,
}) => {
  await enter(page);
  await open(page, 'ai');
  await choices(page);
  const panel = page.locator('.action-dock-panel');
  await expect(panel.getByRole('radio').first()).toBeFocused();
  await panel.getByRole('radio', { name: fr.ai.commercial, exact: false }).check();
  await panel.locator('[data-choice="commercial-generic"] input').check();
  await page.getByRole('button', { name: fr.guidance.close, exact: true }).click();
  await page.getByRole('button', { name: fr.guidance.choices, exact: true }).click();
  await expect(panel.locator('[data-choice="commercial-generic"] input')).toBeChecked();
  await page.getByRole('button', { name: fr.os.minimize, exact: true }).click();
  await page.getByRole('button', { name: fr.os.restore, exact: true }).click();
  await expect(panel.locator('[data-choice="commercial-generic"] input')).toBeChecked();
  await panel.getByRole('button', { name: fr.ai.send, exact: true }).click();
  await expect(page.locator('.decision-review [data-choice="commercial-generic"]')).toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('short landscape viewports can scroll to the guided choice and continue', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 360 });
  await enter(page);
  await open(page, 'web');
  await choices(page);
  const answer = page.locator('.action-dock-panel [data-choice="known-address"]');
  await answer.scrollIntoViewIfNeeded();
  await expect(answer).toBeInViewport({ ratio: 1 });
  await answer.click();
  const next = page.getByRole('button', { name: fr.feedback.continue, exact: true });
  await expect(next).toBeInViewport({ ratio: 1 });
  await next.click();
  await expect(page.locator('[data-challenge]')).toHaveCount(0);
});

test('desktop help only navigates and leaves both activity hints available', async ({ page }) => {
  await enter(page);
  const trigger = page.locator('.companion-trigger');
  await expect(trigger).toHaveText(fr.guide.prompt);
  const fits = await trigger.evaluate((button) => {
    const label = button.querySelector('span')!.getBoundingClientRect();
    const bounds = button.getBoundingClientRect();
    return label.left >= bounds.left && label.right <= bounds.right && bounds.right <= innerWidth;
  });
  expect(fits).toBe(true);
  await trigger.click();
  const guide = page.getByRole('dialog');
  await expect(guide).toContainText('À découvrir');
  await expect(guide).toContainText(fr.guide.remainingMany.replace('{count}', '8'));
  await expect(guide.getByRole('button')).toHaveCount(3);
  await guide.getByRole('button', { name: fr.guide.next, exact: true }).click();
  await expect(page.locator('[data-challenge="usb"]')).toBeVisible();
  await expect(page.locator('.guidance-trigger span')).toBeVisible();
  await expect(page.locator('.guidance-trigger span')).not.toHaveClass(/sr-only/);
  await expect(page.locator('.guidance-message')).toHaveCount(0);
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);
  await page.getByRole('button', { name: fr.guidance.first, exact: true }).click();
  await expect(page.locator('.guidance-message')).toBeVisible();
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);
  await page.getByRole('button', { name: fr.guidance.second, exact: true }).click();
  await expect(page.locator('.action-dock-panel')).toBeVisible();
});

for (const [action, choice] of [
  ['callAction', 'call-number'],
  ['reportAction', 'notify'],
  ['deleteAction', 'delete'],
] as const) {
  test(`incident follow-up offers native ${choice} without revealing hints`, async ({ page }) => {
    await enter(page);
    await open(page, 'incident');
    await page.getByRole('button', { name: fr.incident.isolateNetwork, exact: true }).click();
    await expect(page.locator('.action-dock-panel, .guidance-message')).toHaveCount(0);
    const scenario = page.locator('[data-challenge="incident"]');
    for (const name of ['callAction', 'reportAction', 'deleteAction'] as const) {
      const button = scenario.getByRole('button', { name: fr.incident[name], exact: true });
      await expect(button).toBeVisible();
      await expect(button).not.toHaveClass(/button-primary/);
    }
    await scenario.getByRole('button', { name: fr.incident[action], exact: true }).click();
    await expect(page.locator(`.decision-review [data-choice="${choice}"]`)).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
}

for (const locale of ['fr', 'en'] as const) {
  test(`desktop overview remains readable in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await enter(page);
    await page.getByRole('button', { name: locale.toUpperCase(), exact: true }).click();
    const trigger = page.locator('.companion-trigger');
    await expect(trigger).toBeVisible();
    expect(await trigger.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/previews/desktop-${locale}.png` });
  });
}
