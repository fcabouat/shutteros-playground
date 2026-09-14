import { expect, test } from '@playwright/test';
import { fr } from '@shutteros/core/data/fr';

for (const kiosk of [false, true]) {
  test(`kiosk keyboard guard is opt-in (${kiosk}) and preserves game navigation`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const keyboard = (
        navigator as Navigator & {
          keyboard?: { lock(): Promise<void> };
        }
      ).keyboard;
      if (!keyboard) return;
      const lock = keyboard.lock.bind(keyboard);
      // Observe the real browser API resolution, without replacing its behaviour.
      keyboard.lock = async () => {
        await lock();
        document.documentElement.dataset.keyboardLockAccepted = 'true';
      };
    });
    await page.goto(kiosk ? './?kiosk=1' : './');
    await page.getByLabel('Mot de passe', { exact: true }).fill('Bureau2026');
    await page.getByRole('button', { name: 'Ouvrir la session' }).click();
    await expect(page.getByRole('heading', { name: fr.intro.title })).toBeVisible();
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(kiosk);
    if (kiosk) {
      await expect(page.locator('html')).toHaveAttribute('data-keyboard-lock-accepted', 'true');
    } else {
      await expect(page.locator('html')).not.toHaveAttribute('data-keyboard-lock-accepted');
    }
    // A DOM event proves routing/cancellation, not capture of an OS-reserved key.
    const delivered = await page.evaluate(() => {
      const send = (key: string, ctrlKey = false) =>
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key, ctrlKey, cancelable: true, bubbles: true }),
        );
      return { close: send('w', true), tab: send('Tab'), escape: send('Escape') };
    });
    expect(delivered).toEqual({ close: !kiosk, tab: true, escape: true });
    await page.getByRole('button', { name: 'Explorer le bureau' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Démarrer', exact: true })).toBeVisible();
    await page.keyboard.press('Control+Alt+Home');
    await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible();
  });
}
