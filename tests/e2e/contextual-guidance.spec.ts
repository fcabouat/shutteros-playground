import { test, expect, type Page } from '@playwright/test';
import { fr } from '@shutteros/core/data/fr';
import { guidanceDelayMs } from '@shutteros/core/model/game';

async function enter(page: Page) {
  await page.goto('./');
  await page.getByLabel(fr.login.password, { exact: true }).fill('password');
  await page.getByRole('button', { name: fr.login.enter, exact: true }).click();
  await page.getByRole('button', { name: fr.intro.start, exact: true }).click();
}

async function open(page: Page, id: 'usb' | 'incident' | 'mail' | 'web' | 'mfa' | 'ai') {
  await page.locator(`.desktop-icon:has([data-app="${id}"])`).click();
  await expect(page.locator(`[data-challenge="${id}"]`)).toBeVisible();
}

async function choices(page: Page) {
  const originalWindow = await page.locator('.window-layer .os-window').boundingBox();
  await expect(page.locator('.primary-help-slot .guidance-trigger')).toHaveText(fr.guidance.first);
  await expect(page.locator('.choices-trigger')).toBeDisabled();
  await expect(page.locator('.hint-window-layer')).toBeHidden();
  await page.locator('.primary-help-slot .guidance-trigger').click();
  await expect(page.locator('.choices-trigger')).toBeEnabled();
  expect(await page.locator('.window-layer .os-window').boundingBox()).toEqual(originalWindow);
  await page.locator('.choices-trigger').click();
  await expect(page.locator('.action-dock-panel')).toBeVisible();
  await expect(page.locator('.primary-help-slot .guidance-trigger')).toHaveText(
    fr.guidance.restore,
  );
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

test('hint and choice controls independently expose guidance and selected feedback', async ({
  page,
}) => {
  await enter(page);
  await open(page, 'usb');
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);
  await expect(page.locator('.choices-trigger')).toBeDisabled();
  await page.getByRole('button', { name: fr.guidance.first, exact: true }).click();
  await expect(page.locator('.choices-trigger')).toBeEnabled();
  const sidebar = (await page.locator('.file-sidebar').boundingBox())!;
  const body = (await page.locator('.window-layer .window-body').boundingBox())!;
  expect(sidebar.y + sidebar.height).toBeCloseTo(body.y + body.height, 0);
  await expect(page.locator('[data-hint-target="eject"]').first()).toHaveCSS(
    'outline-width',
    '3px',
  );
  await expect(page.locator('.browser-toolbar button').last()).toHaveCSS('outline-style', 'none');
  await expect(page.locator('[data-hint-target="drive-label"]')).toHaveCount(2);
  for (const label of await page.locator('[data-hint-target="drive-label"]').all()) {
    await expect(label).toHaveCSS('text-decoration-line', 'underline');
  }
  const bar = (await page.locator('.os-topbar').boundingBox())!;
  const help = (await page.locator('.primary-help-slot .guidance-trigger').boundingBox())!;
  expect(help.y).toBeGreaterThanOrEqual(bar.y);
  expect(help.y + help.height).toBeLessThanOrEqual(bar.y + bar.height);
  await expect(page.locator('.primary-help-slot .guidance-trigger')).toHaveText(
    fr.challenge.hideHint,
  );
  await expect(page.locator('.choices-trigger')).toHaveText(fr.guidance.choices);
  await page
    .locator('.hint-content')
    .evaluate((element) =>
      Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
    );
  await page.screenshot({ path: 'test-results/previews/usb-first-hint.png' });
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);
  await page.locator('.choices-trigger').click();
  await expect(page.locator('.hint-window-layer')).toBeHidden();
  await expect(page.locator('.primary-help-slot .guidance-trigger')).toHaveText(
    fr.guidance.restore,
  );
  await expect(page.locator('.choices-trigger')).toHaveText(fr.guidance.close);
  for (const choice of await page.locator('.action-dock-panel [data-choice]').all()) {
    await expect(choice).not.toHaveCSS('outline-color', 'rgb(237, 186, 62)');
  }
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
  await page.getByRole('button', { name: fr.usb.closePreview }).click();
  await page.clock.fastForward(60_100);
  await expect(page.locator('.primary-help-slot .guidance-trigger')).toHaveText(
    fr.challenge.hideHint,
  );
  await page.locator('.primary-help-slot .guidance-trigger').click();
  await page
    .locator('.os-window')
    .getByRole('button', { name: fr.shell.close, exact: true })
    .click();
  await page.clock.fastForward(60_000);
  await open(page, 'usb');
  await expect(page.locator('.hint-window-layer')).toBeVisible();
  await expect(page.locator('.primary-help-slot .guidance-trigger')).toHaveText(
    fr.challenge.hideHint,
  );
  await page.clock.fastForward(118_000);
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);
  await page.locator('#usb-file-2').click();
  await page.getByRole('button', { name: fr.usb.closePreview }).click();
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
  await page.locator('[data-taskbar-window="web"]').click();
  await expect(page.getByRole('button', { name: fr.guidance.first, exact: true })).toBeVisible();
  await expect(page.locator('.action-dock-panel, .ambient-notice')).toHaveCount(0);
  await page.clock.fastForward(60_100);
  await expect(page.locator('.primary-help-slot .guidance-trigger')).toHaveText(
    fr.challenge.hideHint,
  );
  await expect(page.locator('.ambient-notice')).toHaveCount(0);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 960, height: 720 },
]) {
  test(`questionnaire expands a normal frame at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await enter(page);
    await open(page, 'web');
    const window = page.locator('.window-layer .os-window');
    await expect(window).not.toHaveClass(/maximized/);
    const initial = (await window.boundingBox())!;
    await choices(page);
    await expect(window).not.toHaveClass(/maximized/);
    const frame = await window.boundingBox();
    const workspace = await page.locator('.os-workspace').boundingBox();
    const guide = await page.locator('.activity-guidance').boundingBox();
    const panel = await page.locator('.action-dock-panel').boundingBox();
    expect(frame && workspace && guide && panel).toBeTruthy();
    expect(frame!.width).toBeGreaterThanOrEqual(initial.width);
    expect(frame!.width).toBeLessThanOrEqual(workspace!.width);
    if (viewport.width === 1440) expect(frame!.width).toBeCloseTo(1280, 0);
    expectSeparated(frame!, guide!);
    const content = (await page
      .locator('.window-layer .os-window > .window-panes > .window-body')
      .boundingBox())!;
    expectSeparated(content, panel!);
    expect(panel!.x).toBeGreaterThanOrEqual(frame!.x);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(frame!.x + frame!.width);
    await expect(page.locator('.hint-window-layer')).toBeHidden();
    await expect(page.getByRole('button', { name: fr.guidance.close, exact: true })).toBeInViewport(
      { ratio: 1 },
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  });
}

test('questionnaire uses the device width and respects a manually resized application', async ({
  page,
}) => {
  await enter(page);
  await open(page, 'mfa');
  await choices(page);
  const device = page.locator('.window-layer .os-window');
  await expect(device).not.toHaveClass(/maximized/);
  expect((await device.boundingBox())!.width).toBeCloseTo(800, 0);

  await page.locator('[data-taskbar-window="web"]').click();
  await expect(page.locator('[data-challenge="web"]')).toBeVisible();
  const application = page.locator('.window-layer .os-window');
  const resize = application.locator('[data-resize-edge="e"]');
  const before = (await application.boundingBox())!;
  await resize.focus();
  await page.keyboard.press('ArrowRight');
  const resized = (await application.boundingBox())!;
  expect(resized.width).toBeCloseTo(before.width + 10, 0);
  await choices(page);
  await expect(application).not.toHaveClass(/maximized/);
  expect((await application.boundingBox())!.width).toBeCloseTo(resized.width, 0);
});

test('readme opens an editor; ZIP is a risky action; direct eject has the same reviewed result', async ({
  page,
}) => {
  await enter(page);
  await open(page, 'usb');
  await page.locator('#usb-file-2').click();
  await expect(page.getByRole('dialog', { name: fr.usb.readme, exact: true })).toBeVisible();
  await expect(page.locator('.text-editor-document')).toHaveText(fr.usb.readmePreview);
  await expect(page.locator('.feedback-card')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#usb-file-2')).toBeFocused();
  await page.locator('#usb-file-1').click();
  await expect(page.locator('.feedback-card')).toHaveAttribute('data-outcome', 'risky');
  await expect(page.locator('.decision-review [data-choice="archive"]')).toHaveAttribute(
    'aria-current',
    'true',
  );
  await page.getByRole('button', { name: fr.feedback.incident, exact: true }).click();
  await page
    .locator('.os-window')
    .getByRole('button', { name: fr.shell.close, exact: true })
    .click();
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
  await page
    .locator('.os-window')
    .getByRole('button', { name: fr.shell.close, exact: true })
    .click();
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

test('the choices control moves keyboard focus and keeps an AI draft across hiding', async ({
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
  await page.locator('[data-taskbar-window="core-ai"]').click();
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

test('the remaining counter opens the guide and leaves both activity controls available', async ({
  page,
}) => {
  await enter(page);
  const trigger = page.locator('.companion-trigger');
  await expect(trigger).toHaveAccessibleName(/activit/);
  await expect(trigger).toHaveText(fr.guide.counterMany.replace('{count}', '8'));
  const fits = await trigger.evaluate((button) => {
    const label = button.querySelector('span:not(.help-cue)')!.getBoundingClientRect();
    const bounds = button.getBoundingClientRect();
    return label.left >= bounds.left && label.right <= bounds.right && bounds.right <= innerWidth;
  });
  expect(fits).toBe(true);
  const helpPosition = await trigger.boundingBox();
  await trigger.click();
  const guide = page.getByRole('dialog');
  await expect(guide).toContainText('À découvrir');
  await expect(guide).toContainText(fr.guide.remainingMany.replace('{count}', '8'));
  await expect(guide.getByRole('button')).toHaveCount(3);
  await guide.getByRole('button', { name: fr.guide.next, exact: true }).click();
  await expect(page.locator('[data-challenge="usb"]')).toBeVisible();
  await expect(trigger).toBeDisabled();
  expect(await trigger.boundingBox()).toEqual(helpPosition);
  const activityHelp = await page.locator('.primary-help-slot .guidance-trigger').boundingBox();
  expect(activityHelp!.x).toBeGreaterThanOrEqual(helpPosition!.x + helpPosition!.width);
  expect(activityHelp!.y).toBeCloseTo(helpPosition!.y, 0);
  await expect(
    page.locator('.primary-help-slot .guidance-trigger > span:not(.help-cue)'),
  ).toBeVisible();
  await expect(
    page.locator('.primary-help-slot .guidance-trigger > span:not(.help-cue)'),
  ).not.toHaveClass(/sr-only/);
  await expect(page.locator('.hint-content')).toHaveCount(0);
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);
  await page.getByRole('button', { name: fr.guidance.first, exact: true }).click();
  await expect(page.locator('.hint-content')).toBeVisible();
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);
  await page.locator('.choices-trigger').click();
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
    await expect(page.locator('.action-dock-panel, .hint-content')).toHaveCount(0);
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
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
      true,
    );
    expect(await trigger.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/previews/desktop-${locale}.png` });
  });
}

test('hint text preserves maximized bounds and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page);
  await open(page, 'usb');
  await page.getByRole('button', { name: fr.os.maximize, exact: true }).click();
  const window = page.locator('.window-layer .os-window');
  const before = (await window.boundingBox())!;
  await page.getByRole('button', { name: fr.guidance.first, exact: true }).click();
  expect(await window.boundingBox()).toEqual(before);
  const hint = page.locator('.hint-content');
  await expect(hint).toHaveCSS('animation-name', 'none');
  const box = (await hint.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  const highlightedDrive = page.locator('[data-hint-target="eject"]').first();
  const driveLabel = page.locator('[data-hint-target="drive-label"]').first();
  await expect(highlightedDrive).toHaveCSS('outline-style', 'solid');
  await expect(driveLabel).toHaveCSS('text-decoration-line', 'underline');
  await page.locator('.primary-help-slot .guidance-trigger').click();
  await expect(hint).toBeHidden();
  await expect(highlightedDrive).not.toHaveCSS('outline-style', 'solid');
  await expect(driveLabel).not.toHaveCSS('text-decoration-line', 'underline');
  await page.locator('[data-taskbar-window="hint"]').click();
  await expect(hint).toBeVisible();
  await expect(highlightedDrive).toHaveCSS('outline-style', 'solid');
  await expect(driveLabel).toHaveCSS('text-decoration-line', 'underline');
  expect(await window.boundingBox()).toEqual(before);
  await expect(page.locator('.primary-help-slot .guidance-trigger')).toHaveText(
    fr.challenge.hideHint,
  );
});

for (const id of ['web', 'mfa'] as const) {
  test(`${id} first hint offers text without highlighting an answer`, async ({ page }) => {
    await enter(page);
    await open(page, id);
    await page.getByRole('button', { name: fr.guidance.first, exact: true }).click();
    await expect(page.locator('.hint-content')).toHaveText(fr.guidance.hints[id]);
    await expect(page.locator('[data-active-hint]')).toHaveCount(0);
    await expect(page.locator('.action-dock-panel')).toHaveCount(0);
  });
}

test('infection hint highlights the network status rather than the Wi-Fi action', async ({
  page,
}) => {
  await enter(page);
  await open(page, 'incident');
  await page.getByRole('button', { name: fr.guidance.first, exact: true }).click();
  await expect(page.locator('[data-hint-target="network-status"]')).toHaveCSS(
    'outline-width',
    '3px',
  );
  await expect(page.locator('[data-hint-target="network"]')).toHaveCSS('box-shadow', 'none');
  await page.locator('.primary-help-slot .guidance-trigger').click();
  await expect(page.locator('[data-active-hint]')).toHaveCount(0);
});

test('AI hint highlights the policy as well as the tool choice', async ({ page }) => {
  await enter(page);
  await open(page, 'ai');
  await page.getByRole('button', { name: fr.guidance.first, exact: true }).click();
  const policy = page.getByRole('button', { name: fr.ai.policy, exact: true });
  await expect(policy).toHaveCSS('outline-color', 'rgb(237, 186, 62)');
  await page.locator('.primary-help-slot .guidance-trigger').click();
  await expect(policy).not.toHaveCSS('outline-color', 'rgb(237, 186, 62)');
  await policy.click();
  await expect(page.getByText(fr.ai.policyRules[2], { exact: true })).toBeVisible();
});

for (const [id, target] of [
  ['mail', 'sender-details'],
  ['spoof', 'personal-destination'],
] as const) {
  test(`${id} hint draws attention to evidence, not an answer`, async ({ page }) => {
    await enter(page);
    await open(page, 'mail');
    if (id === 'spoof') await page.locator('.mail-list-message').nth(1).click();
    await page.getByRole('button', { name: fr.guidance.first, exact: true }).click();
    await expect(page.locator('[data-active-hint]')).toHaveAttribute('data-active-hint', target);
    await expect(page.locator(`[data-hint-target="${target}"]`)).toBeVisible();
    const cue = page.locator(`[data-hint-target="${target}"]`);
    if (id === 'spoof') {
      await expect(cue).toHaveText(fr.spoof.hintPhrase);
      await expect(cue).toHaveCSS('text-decoration-line', 'underline');
    } else await expect(cue).toHaveCSS('outline-color', 'rgb(237, 186, 62)');
    await page.getByRole('button', { name: fr.guidance.minimize, exact: true }).click();
    await expect(page.locator('[data-active-hint]')).toHaveCount(0);
  });
}

test('guided choices keep hint visibility independent from the restored window size', async ({
  page,
}) => {
  await enter(page);
  await page.getByRole('button', { name: fr.experience.finish, exact: true }).first().click();
  const frame = page.locator('.window-layer .os-window');
  await expect(frame).toHaveClass(/maximized/);
  await expect(page.locator('.action-dock-panel')).toBeVisible();
  await expect(page.locator('.hint-window-layer')).toBeHidden();
  const hintControl = page.locator('.primary-help-slot .guidance-trigger');
  await expect(hintControl).toHaveText(fr.guidance.first);
  await hintControl.click();
  await expect(page.locator('.hint-window-layer')).toBeVisible();
  await expect(page.locator('[data-active-hint]')).toHaveAttribute('data-active-hint', 'eject');
  await expect(page.locator('.action-dock-panel')).toBeVisible();
  await page.getByRole('button', { name: fr.guidance.minimize, exact: true }).click();
  await expect(page.locator('.hint-window-layer')).toBeHidden();
  await expect(hintControl).toHaveText(fr.guidance.restore);
  await frame.getByRole('button', { name: fr.os.restoreSize, exact: true }).click();
  await expect(frame).not.toHaveClass(/maximized/);
  await expect(page.locator('.action-dock-panel')).toBeVisible();
});

test('activity windows and mode switches preserve only the state that belongs to them', async ({
  page,
}) => {
  await enter(page);
  const frame = page.locator('.window-layer .os-window');

  await open(page, 'usb');
  await frame.getByRole('button', { name: fr.os.maximize, exact: true }).click();
  await expect(frame).toHaveClass(/maximized/);

  await page.locator('[data-taskbar-window="web"]').click();
  await expect(page.locator('[data-challenge="web"]')).toBeVisible();
  await expect(frame).not.toHaveClass(/maximized/);
  await choices(page);
  await expect(frame).not.toHaveClass(/maximized/);
  await expect(page.locator('.action-dock-panel')).toBeVisible();

  await page.getByRole('button', { name: fr.experience.finish, exact: true }).first().click();
  await expect(page.locator('.finish-experience')).toHaveText(fr.experience.free);
  await expect(page.locator('[data-challenge="web"][data-step="choose"]')).toBeVisible();
  await expect(frame).toHaveClass(/maximized/);
  await expect(page.locator('.action-dock-panel')).toBeVisible();

  await frame.getByRole('button', { name: fr.os.restoreSize, exact: true }).click();
  await expect(frame).not.toHaveClass(/maximized/);
  await page.locator('.action-dock-panel [data-choice="known-address"]').click();
  await expect(page.locator('.learning-takeaway')).toBeVisible();
  await expect(frame).not.toHaveClass(/maximized/);

  await page.getByRole('button', { name: fr.experience.next, exact: true }).click();
  const guidedActivity = page.locator('[data-challenge][data-step="choose"]');
  await expect(guidedActivity).toBeVisible();
  const guidedId = await guidedActivity.getAttribute('data-challenge');
  await expect(frame).toHaveClass(/maximized/);

  await page.getByRole('button', { name: fr.experience.free, exact: true }).first().click();
  await expect(page.locator('.finish-experience')).toHaveText(fr.experience.finish);
  await expect(page.locator(`[data-challenge="${guidedId}"][data-step="choose"]`)).toBeVisible();
  await expect(page.locator('.action-dock-panel')).toBeVisible();
  await expect(page.locator('.choices-trigger')).toBeEnabled();
  await expect(frame).not.toHaveClass(/maximized/);

  await page.locator('[data-taskbar-window="mail"]').click();
  await expect(page.locator('[data-challenge="mail"]')).toBeVisible();
  await expect(frame).not.toHaveClass(/maximized/);
  await expect(page.locator('.choices-trigger')).toBeDisabled();
});
