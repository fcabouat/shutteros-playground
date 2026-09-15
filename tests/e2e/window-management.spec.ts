import { test, expect, type Page } from '@playwright/test';
import { fr } from '@shutteros/core/data/fr';
import AxeBuilder from '@axe-core/playwright';

async function login(page: Page) {
  await page.goto('./');
  await page.getByLabel(fr.login.password, { exact: true }).fill('password');
  await page.getByRole('button', { name: fr.login.enter, exact: true }).click();
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`maximized welcome fills the desktop and remains reachable at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await login(page);
    const counter = page.locator('.progress-slot .companion-trigger');
    await expect(counter).toHaveAccessibleName(/activit/);
    await expect(counter).toHaveText(fr.guide.counterMany.replace('{count}', '8'));
    await expect(counter).toBeDisabled();
    await expect(page.locator('.primary-help-slot .guidance-trigger')).toHaveText(
      fr.guidance.first,
    );
    await expect(page.locator('.primary-help-slot .guidance-trigger')).toBeDisabled();
    await expect(page.locator('.choices-trigger')).toBeDisabled();
    await expect(page.locator('.restore-hint')).toHaveCount(0);
    await expect(page.locator('.finish-experience')).toBeDisabled();
    const frame = page.locator('.window-layer .os-window');
    if (viewport.width === 1440) {
      const initial = (await frame.boundingBox())!;
      const workspace = (await page.locator('.os-workspace').boundingBox())!;
      expect(initial.height).toBeLessThan(workspace.height * 0.6);
    }
    await frame.getByRole('button', { name: fr.os.maximize, exact: true }).click();
    const workspace = (await page.locator('.os-workspace').boundingBox())!;
    expect(await frame.boundingBox()).toEqual(workspace);
    const body = (await frame.locator('.window-body').boundingBox())!;
    const reading = (await frame.locator('.reading-column').boundingBox())!;
    expect(reading.y + reading.height / 2).toBeCloseTo(body.y + body.height / 2, 0);
    await expect(page.getByRole('button', { name: fr.intro.start, exact: true })).toBeInViewport({
      ratio: 1,
    });
    await frame.getByRole('button', { name: fr.os.minimize, exact: true }).click();
    const task = page.locator('[data-taskbar-window="core-intro"]');
    await expect(task).toBeInViewport({ ratio: 1 });
    await task.click();
    await expect(frame).toBeVisible();
    expect(await frame.boundingBox()).toEqual(workspace);
    if (viewport.width === 1440)
      await page.screenshot({ path: 'test-results/previews/maximized-welcome.png' });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('document and hint have independent taskbar entries and retain their state', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('button', { name: fr.intro.start, exact: true }).click();
  await page.locator('[data-taskbar-window="usb"]').click();
  await page.locator('#usb-file-2').click();
  const editor = page.locator('.readme-window-layer');
  await editor.getByRole('button', { name: fr.os.minimize, exact: true }).click();
  const documentTask = page.locator('[data-taskbar-window="readme"]');
  await expect(documentTask).toBeFocused();
  await documentTask.click();
  await expect(editor).toBeFocused();
  await page.locator('[data-taskbar-window="web"]').click();
  await expect(editor).toBeHidden();
  await documentTask.click();
  await expect(editor).toBeVisible();
  await expect(editor).toContainText(fr.usb.readmeAdvisory);
  await editor.getByRole('button', { name: fr.usb.closePreview, exact: true }).click();
  await expect(documentTask).toHaveCount(0);
  await expect(page.locator('.window-layer [data-window-focus]')).toBeFocused();

  await page.getByRole('button', { name: fr.guidance.first, exact: true }).click();
  const hint = page.locator('.hint-window-layer');
  await expect(hint).toContainText(fr.guidance.hints.web);
  const hintControl = page.locator('.primary-help-slot .guidance-trigger');
  await expect(hintControl).toHaveText(fr.challenge.hideHint);
  await expect(hintControl).toBeEnabled();
  const before = (await hint.locator('.os-window').boundingBox())!;
  const handle = hint.getByRole('button', { name: fr.experience.move, exact: true });
  await handle.focus();
  await page.keyboard.press('ArrowLeft');
  expect((await hint.locator('.os-window').boundingBox())!.x).toBeLessThan(before.x);
  await hint.getByRole('button', { name: fr.guidance.minimize, exact: true }).click();
  await expect(hint).toBeHidden();
  await expect(hintControl).toHaveText(fr.guidance.restore);
  await expect(hintControl).toBeEnabled();
  const hintTask = page.locator('[data-taskbar-window="hint"]');
  await expect(hintTask).toBeFocused();
  await hintTask.click();
  await expect(hint).toBeFocused();
  await expect(hint).toContainText(fr.guidance.hints.web);
  await expect(hintControl).toHaveText(fr.challenge.hideHint);
  await expect(hintControl).toBeEnabled();
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);
  await expect(page.locator('.choices-trigger')).toHaveText(fr.guidance.choices);
  await hint
    .locator('.hint-content')
    .evaluate((element) =>
      Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
    );
  await page.screenshot({ path: 'test-results/previews/floating-hint.png' });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator('.choices-trigger').click();
  await expect(hint).toBeHidden();
  await page.getByRole('button', { name: fr.guidance.close, exact: true }).click();
  await hintControl.click();
  await expect(hint).toBeVisible();
  await page.locator('.choices-trigger').click();
  await expect(hint).toBeHidden();
  await expect(page.locator('.action-dock-panel')).toBeVisible();
});

test('settings remain listed after minimization and a switch to another application', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('button', { name: fr.intro.start, exact: true }).click();
  await page.getByRole('button', { name: fr.os.start, exact: true }).click();
  await page.getByRole('button', { name: fr.about.title, exact: true }).click();
  await page.getByRole('button', { name: fr.os.minimize, exact: true }).click();
  await page.locator('[data-taskbar-window="usb"]').click();
  await page.locator('[data-taskbar-window="settings"]').click();
  await expect(page.locator('.window-layer .view-host:not([hidden])')).toContainText(
    fr.about.title,
  );
  await page.locator('[data-taskbar-window="usb"]').click();
  await expect(page.locator('[data-challenge="usb"]')).toBeVisible();
  await expect(page.locator('[data-taskbar-window="settings"]')).toBeVisible();
});

test('main windows resize without moving their top-left corner; popups keep their fitted size', async ({
  page,
}) => {
  await login(page);
  const frame = page.locator('.window-layer .os-window');
  const before = (await frame.boundingBox())!;
  const grip = frame.locator('[data-resize-edge="se"]');
  const corner = (await grip.boundingBox())!;
  await page.mouse.move(corner.x + 8, corner.y + 8);
  await page.mouse.down();
  await page.mouse.move(corner.x + 88, corner.y + 68);
  await page.mouse.up();
  const resized = (await frame.boundingBox())!;
  expect(resized.x).toBeCloseTo(before.x, 0);
  expect(resized.y).toBeCloseTo(before.y, 0);
  expect(resized.width).toBeCloseTo(before.width + 80, 0);
  expect(resized.height).toBeCloseTo(before.height + 60, 0);
  await grip.focus();
  await page.keyboard.press('ArrowLeft');
  expect((await frame.boundingBox())!.width).toBeCloseTo(resized.width - 10, 0);
  await frame.getByRole('button', { name: fr.os.maximize, exact: true }).click();
  await frame.getByRole('button', { name: fr.os.restoreSize, exact: true }).click();
  expect((await frame.boundingBox())!.width).toBeCloseTo(resized.width - 10, 0);
  const handle = frame.getByRole('button', { name: fr.experience.move, exact: true });
  const title = (await handle.boundingBox())!;
  await page.mouse.move(title.x + 20, title.y + 12);
  await page.mouse.down();
  await page.mouse.move(title.x + 20, 0);
  await page.mouse.up();
  expect((await frame.boundingBox())!.y).toBeCloseTo(
    (await page.locator('.os-workspace').boundingBox())!.y,
    0,
  );
  await page.getByRole('button', { name: fr.intro.start, exact: true }).click();
  await page.locator('[data-taskbar-window="usb"]').click();
  await page.locator('#usb-file-2').click();
  await expect(page.locator('.readme-window-layer .window-resize-handle')).toHaveCount(0);
  await page.locator('[data-taskbar-window="usb"]').click();
  await page.getByRole('button', { name: fr.guidance.first, exact: true }).click();
  await expect(page.locator('.hint-window-layer .window-resize-handle')).toHaveCount(0);
});

test('every window edge resizes while keeping its opposite edge anchored', async ({ page }) => {
  await login(page);
  const frame = page.locator('.window-layer .os-window');
  for (const edge of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']) {
    const before = (await frame.boundingBox())!;
    const handle = frame.locator(`[data-resize-edge="${edge}"]`);
    const grip = (await handle.boundingBox())!;
    const dx = edge.includes('w') ? 12 : edge.includes('e') ? -12 : 0;
    const dy = edge.includes('n') ? 12 : edge.includes('s') ? -12 : 0;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 + dx, grip.y + grip.height / 2 + dy);
    await page.mouse.up();
    const after = (await frame.boundingBox())!;
    expect(after.width, edge).toBeCloseTo(before.width - Math.abs(dx), 0);
    expect(after.height, edge).toBeCloseTo(before.height - Math.abs(dy), 0);
    expect(after.x, edge).toBeCloseTo(before.x + Math.max(0, dx), 0);
    expect(after.y, edge).toBeCloseTo(before.y + Math.max(0, dy), 0);
  }
  const before = (await frame.boundingBox())!;
  const grip = (await frame.locator('[data-resize-edge="nw"]').boundingBox())!;
  await page.mouse.move(grip.x + 8, grip.y + 8);
  await page.mouse.down();
  await page.mouse.move(0, 0);
  await page.mouse.up();
  const after = (await frame.boundingBox())!;
  const workspace = (await page.locator('.os-workspace').boundingBox())!;
  expect(after.x).toBeGreaterThanOrEqual(workspace.x);
  expect(after.y).toBeGreaterThanOrEqual(workspace.y);
  expect(after.x + after.width).toBeCloseTo(before.x + before.width, 0);
  expect(after.y + after.height).toBeCloseTo(before.y + before.height, 0);
});

for (const [id, surface] of [
  ['mail', '.mail-list'],
  ['ai', '.ai-chat'],
  ['web', '.web-scene'],
] as const) {
  test(`${id} application surface fills the window height`, async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: fr.intro.start, exact: true }).click();
    await page.locator(`.desktop-icon:has([data-app="${id}"])`).click();
    const frame = page.locator('.window-layer .os-window');
    const body = (await frame.locator('.window-body').boundingBox())!;
    const panel = (await frame.locator(surface).boundingBox())!;
    expect(panel.y + panel.height).toBeCloseTo(body.y + body.height, 0);
    await expect(frame.getByRole('button', { name: fr.os.resize, exact: true })).toHaveCount(1);
  });
}
