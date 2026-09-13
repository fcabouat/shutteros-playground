import { test, expect, type Page } from '@playwright/test';
import { en } from '@shutteros/core/data/en';
import { fr } from '@shutteros/core/data/fr';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import config from '../../static/kiosk-config.json' with { type: 'json' };

const portable = pathToFileURL(path.resolve('dist/portable/shutteros.html')).href;
const sessionDurationMs = config.sessionMinutes * 60_000;

function clockLabel(durationMs: number) {
  const seconds = Math.ceil(durationMs / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

async function signIn(page: Page) {
  await page.getByLabel('Mot de passe', { exact: true }).fill('  PASSWORD  ');
  await page.getByRole('button', { name: 'Ouvrir la session' }).click();
  await expect(page.getByRole('heading', { name: fr.intro.title })).toBeVisible();
}

async function answerKnowledge(
  page: Page,
  id: 'password' | 'incident' | 'mfa',
  optionIndex: number,
  expected: string,
) {
  const check = page.locator(`[data-knowledge="${id}"]`);
  if (!(await check.isVisible())) {
    await page.getByRole('button', { name: 'Tester ce réflexe', exact: true }).click();
  }
  await expect(check).toBeVisible();
  await check.locator('.knowledge-option').nth(optionIndex).click();
  await expect(check.getByRole('status')).toContainText(expected);
}

async function enter(page: Page) {
  await signIn(page);
  await expect(page.getByRole('button', { name: 'Explorer le bureau' })).toBeInViewport({
    ratio: 1,
  });
  await page.getByRole('button', { name: 'Explorer le bureau' }).click();
}

async function openNext(page: Page, id: string, decision = true) {
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click();
  const menu = page.locator('.start-menu');
  await expect(menu).toBeVisible();
  await menu.locator(`.start-app:has([data-app="${id}"])`).click();
  await expect(page.locator(`[data-challenge="${id}"]`)).toBeVisible();
  if (decision) await beginDecision(page, id);
}

async function beginDecision(page: Page, id: string) {
  const challenge = page.locator(`[data-challenge="${id}"]`);
  if (id !== 'spoof' && (await challenge.getAttribute('data-step')) === 'explore') {
    const panel = page.locator('.action-dock-panel');
    if (await panel.isVisible()) return;
    const trigger = page.getByRole('button', { name: 'Que faire ?', exact: true });
    if (await trigger.isVisible()) await trigger.click();
  }
}

async function sendSafeAiPrompt(page: Page) {
  await expect(page.locator('[data-challenge="ai"]')).toBeVisible();
  await page.getByRole('button', { name: fr.ai.connect, exact: true }).click();
  await page.getByRole('radio', { name: fr.ai.generic, exact: true }).check();
  await page.getByRole('button', { name: fr.ai.send, exact: true }).click();
}

async function advance(page: Page) {
  await page.getByRole('button', { name: 'Continuer l’exploration' }).click();
}

async function advanceGuided(page: Page) {
  await page.getByRole('button', { name: 'Passer au réflexe suivant' }).click();
}

async function expectNoAxeViolations(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
}

test('guided completion sweeps remaining situations without local timers', async ({ page }) => {
  await page.goto('./');
  await enter(page);
  await page.getByRole('button', { name: 'Terminer l’expérience', exact: true }).first().click();
  await expect(page.locator('[data-challenge="usb"][data-step="choose"]')).toBeVisible();
  await expect(page.locator('.ambient-notice')).toHaveCount(0);
  await page.getByRole('button', { name: 'Passer par la station blanche', exact: false }).click();
  await advanceGuided(page);
  await page.getByRole('button', { name: 'Couper la connexion réseau', exact: false }).click();
  await page
    .getByRole('button', { name: 'Les équipes de sécurité informatique', exact: false })
    .click();
  await advanceGuided(page);
  await page.getByRole('button', { name: 'Contacter les RH via l’annuaire', exact: false }).click();
  await advanceGuided(page);
  await expect(page.locator('[data-challenge="spoof"][data-step="explore"]')).toBeVisible();
  await page.getByRole('button', { name: 'Envoyer dans la simulation' }).click();
  await expect(
    page.getByRole('button', { name: 'J’ai compris : je vérifie l’identité' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Déplier l’expéditeur' }).click();
  await page.getByRole('button', { name: 'J’ai compris : je vérifie l’identité' }).click();
  await advanceGuided(page);
  await page.getByRole('button', { name: 'Revenir à mon favori connu', exact: false }).click();
  await advanceGuided(page);
  await page.getByRole('button', { name: 'Refuser et signaler', exact: false }).click();
  await advanceGuided(page);
  await sendSafeAiPrompt(page);
  await advanceGuided(page);

  await expect(page.getByRole('heading', { name: 'Les gestes du quotidien' })).toBeVisible();
  await page
    .getByRole('button', { name: 'Créer un secret unique avec le gestionnaire approuvé' })
    .click();
  await answerKnowledge(page, 'password', 0, 'Exact.');
  await expectNoAxeViolations(page);
  await page
    .getByRole('button', { name: 'Accepter la mise à jour prévue par le Service Informatique' })
    .click();
  await page.getByRole('button', { name: 'Verrouiller la session simulée' }).click();
  await expect(page.getByRole('button', { name: 'Reprendre la simulation' })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Reprendre la simulation' }).click();
  await page.getByRole('button', { name: 'Voir mon bilan maintenant' }).click();
  await expect(page.getByText('6 bons réflexes sur 6 situations explorées')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Un coup de pouce', exact: true })).toHaveCount(0);
  await expect(page.locator('.guide-dialog')).toHaveCount(0);
  await expectNoAxeViolations(page);
});

for (const delivery of ['http', 'file'] as const) {
  test(`${delivery}: complete all situations, inspect spoofing, and reset`, async ({
    page,
    context,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const errors: string[] = [];
    const external: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (
        /^https?:/.test(request.url()) &&
        new URL(request.url()).origin !== new URL(baseURL!).origin
      )
        external.push(request.url());
    });
    if (delivery === 'file') await context.setOffline(true);
    await page.goto(delivery === 'file' ? portable : './');
    if (delivery === 'http') {
      await mkdir('test-results/previews', { recursive: true });
      await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible();
      await page.screenshot({ path: 'test-results/previews/login.png', fullPage: true });
    }
    await enter(page);
    await page.getByRole('button', { name: 'Démarrer', exact: true }).click();
    await page.getByRole('button', { name: 'À propos de ShutterOS', exact: true }).click();
    await expect(page.getByText('Créé par F. Cabouat · Licence MIT')).toBeVisible();
    await page.getByText('Licence complète du projet', { exact: true }).click();
    await expect(page.locator('.about-notice').first()).toContainText(
      'Copyright (c) 2026 F. Cabouat',
    );
    await page.getByText('Licences tierces et mentions', { exact: true }).click();
    await expect(page.locator('.about-notice').last()).toContainText('@lucide/svelte');
    await expect(page.locator('.about-notice').last()).toContainText('svelte-toolbelt');
    await page.getByRole('button', { name: 'Fermer', exact: true }).click();
    const taskbar = await page.locator('.os-taskbar').boundingBox();
    expect(taskbar).not.toBeNull();
    expect(taskbar!.y + taskbar!.height).toBeCloseTo(720, 0);
    expect(taskbar!.height).toBeLessThanOrEqual(80);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
    if (delivery === 'http')
      await page.screenshot({ path: 'test-results/previews/desktop.png', fullPage: true });
    else
      await page.screenshot({ path: 'test-results/previews/desktop-portable.png', fullPage: true });

    await openNext(page, 'usb');
    await page.getByRole('button', { name: 'Passer par la station blanche', exact: false }).click();
    await advance(page);

    await openNext(page, 'incident');
    await page.getByRole('button', { name: 'Couper la connexion réseau', exact: false }).click();
    await expect(
      page.getByRole('heading', { name: 'Le poste est isolé. Qui prévenez-vous ?' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Les équipes de sécurité informatique', exact: false })
      .click();
    await answerKnowledge(page, 'incident', 1, 'Exact.');
    await advance(page);

    await openNext(page, 'mail');
    await page.getByRole('button', { name: 'Mon compte' }).click();
    await page
      .getByRole('button', { name: 'Créer un secret unique avec le gestionnaire approuvé' })
      .click();
    await page.getByText('Tester ce réflexe').click();
    await answerKnowledge(page, 'password', 0, 'Exact.');
    await page.getByRole('button', { name: 'Retour aux messages' }).click();
    await page.getByRole('button', { name: 'Voir l’adresse complète' }).click();
    await expect(page.getByText('rh@services-personnel.example', { exact: true })).toBeVisible();
    await page
      .getByRole('button', { name: 'Contacter les RH via l’annuaire', exact: false })
      .click();
    await advance(page);

    await openNext(page, 'spoof');
    await page.getByLabel('De', { exact: true }).selectOption('impostor');
    await page.getByLabel('Nom affiché', { exact: true }).fill('La direction');
    await page.getByRole('button', { name: 'Envoyer dans la simulation' }).click();
    await page.getByRole('button', { name: 'Déplier l’expéditeur' }).click();
    await expect(page.getByTestId('received-address')).toHaveText(config.mailImpersonatorAddress);
    await page.getByRole('button', { name: 'Modifier et réessayer' }).click();
    await page.getByLabel('De', { exact: true }).selectOption('legitimate');
    await page.getByRole('button', { name: 'Envoyer dans la simulation' }).click();
    await page.getByRole('button', { name: 'Déplier l’expéditeur' }).click();
    await expect(page.getByTestId('received-address')).toHaveText(config.mailLegitimateAddress);
    await page.getByRole('button', { name: 'J’ai compris : je vérifie l’identité' }).click();
    await advance(page);

    await openNext(page, 'web');
    await page.getByRole('button', { name: 'Examiner cette adresse' }).click();
    await expect(page.getByText(fr.web.inspector, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Revenir à mon favori connu', exact: false }).click();
    await advance(page);

    await openNext(page, 'mfa');
    await page.getByRole('button', { name: 'Refuser et signaler', exact: false }).click();
    await answerKnowledge(page, 'mfa', 1, 'Exact.');
    await advance(page);
    await openNext(page, 'ai', false);
    await sendSafeAiPrompt(page);
    await page.getByRole('button', { name: 'Découvrir mon bilan' }).click();
    await expect(page.getByText('6 bons réflexes sur 6 situations explorées')).toBeVisible();
    await page.getByRole('button', { name: 'Passer au joueur suivant' }).click();
    await page.getByRole('button', { name: 'Quitter et effacer ma progression' }).click();
    await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveValue('');
    await expect(page.getByText('La session a été effacée. À vous de jouer !')).toBeVisible();
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    expect(
      await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
    ).toEqual({ local: 0, session: 0 });
  });
}

test('the desktop USB opens an explorer before running a file triggers the incident', async ({
  page,
}) => {
  await page.goto('./');
  await enter(page);
  await page.getByRole('button', { name: 'Clé USB trouvée', exact: true }).dblclick();
  await expect(page.locator('[data-challenge="usb"][data-step="explore"]')).toBeVisible();
  await expect(page.locator('.feedback-card, .action-dock-panel')).toHaveCount(0);
  await page.locator('.usb-file').click();
  await expect(page.locator('[data-challenge="usb"]')).toBeVisible();
  await page.getByRole('button', { name: fr.usb.openFile, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Un piège, et un déclic.' })).toBeVisible();
  await page.getByRole('button', { name: 'Réagir à l’incident' }).click();
  await expect(page.getByText(fr.incident.infected)).toBeVisible();
});

test('login reveals its hint only after three failures and still accepts PASSWORD', async ({
  page,
}) => {
  await page.goto('./');
  const password = page.getByLabel('Mot de passe', { exact: true });
  await expect(password).toHaveAttribute('type', 'text');
  await expect(page.locator('input[type="password"], form')).toHaveCount(0);
  const postIt = page.locator('.post-it');
  const hint = page.getByText(fr.login.helper);

  await expect(postIt).toHaveText('Bureau2026');
  await expect(hint).toHaveCount(0);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await password.fill('incorrect');
    await page.getByRole('button', { name: 'Ouvrir la session' }).click();
    await expect(page.getByRole('alert')).toHaveText('Mot de passe incorrect. Réessayez.');
    await expect(hint).toHaveCount(0);
  }

  await password.fill('incorrect');
  await page.getByRole('button', { name: 'Ouvrir la session' }).click();
  await expect(hint).toBeVisible();
  await signIn(page);
});

test('an optional wrong password check does not block the mail situation', async ({ page }) => {
  await page.goto('./');
  await enter(page);
  await openNext(page, 'mail');
  await page.getByRole('button', { name: 'Mon compte' }).click();
  await page
    .getByRole('button', { name: 'Créer un secret unique avec le gestionnaire approuvé' })
    .click();
  await page.getByText('Tester ce réflexe').click();
  await answerKnowledge(page, 'password', 1, 'À retenir.');
  await page.getByRole('button', { name: 'Retour aux messages' }).click();
  await page.getByRole('button', { name: 'Contacter les RH via l’annuaire', exact: false }).click();
  await expect(page.locator('.feedback-card')).toBeVisible();
});

test('hard deadline resets an open modal and all transient fields', async ({ page }) => {
  await page.clock.install();
  await page.goto('./');
  await enter(page);
  await page.getByRole('button', { name: 'Un coup de pouce', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.clock.fastForward(sessionDurationMs + 100);
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Le temps est écoulé.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeEditable();
  await page.getByLabel('Mot de passe', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Ouvrir la session' }).click();
  await expect(
    page.getByLabel(`Temps restant dans la session : ${clockLabel(sessionDurationMs)}`),
  ).toBeVisible();
});

test('legacy challenge timing config is ignored and MFA stays actionable', async ({ page }) => {
  await page.clock.install();
  await page.route('**/kiosk-config.json', (route) =>
    route.fulfill({ json: { ...config, challengeSeconds: 10, defaultCalmMode: false } }),
  );
  await page.goto('./');
  await enter(page);
  await openNext(page, 'mfa', false);
  await page.clock.fastForward(11_000);
  await expect(page.locator('.action-dock [role="timer"]')).toHaveCount(0);
  await expect(page.locator('.feedback-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Refuser et signaler', exact: false }).click();
  await expect(page.locator('.feedback-card')).toBeVisible();
});

test('invalid configuration fails visibly without fallback', async ({ page }) => {
  await page.route('**/kiosk-config.json', (route) =>
    route.fulfill({ json: { ...config, sessionMinutes: 'five' } }),
  );
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'La borne a besoin d’un réglage' })).toBeVisible();
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveCount(0);
});

test('keyboard guide, language switching, and mobile reflow', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByLabel('Password', { exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: en.intro.title })).toBeVisible();
  await expect(page.getByRole('button', { name: 'A hint', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Explore the desk', exact: true }).click();
  await page.getByRole('button', { name: 'A hint', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAttribute('lang', 'en');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.start-menu')).toHaveAttribute('lang', 'en');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'FR', exact: true }).click();
  const guide = page.getByRole('button', { name: 'Un coup de pouce', exact: true }).first();
  await guide.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(guide).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Démarrer', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Quitter la session', exact: true }).click();
  await page.getByRole('button', { name: 'Quitter et effacer ma progression' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('dragged spoof composer survives minimizing and restoring its window', async ({ page }) => {
  await page.goto('./');
  await enter(page);
  await openNext(page, 'spoof');
  const displayName = page.getByLabel('Nom affiché', { exact: true });
  await displayName.fill('La direction');
  const frame = page.locator('.os-window');
  const before = await frame.boundingBox();
  const handle = page.getByRole('button', { name: 'Déplacer la fenêtre' });
  const handleBox = await handle.boundingBox();
  expect(before).not.toBeNull();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + 20, handleBox!.y + 12);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + 80, handleBox!.y + 42);
  await page.mouse.up();
  expect((await frame.boundingBox())!.x).not.toBe(before!.x);
  await page.getByRole('button', { name: 'Réduire la fenêtre', exact: true }).click();
  await expect(page.locator('#session-main')).toBeVisible();
  await page.locator('.os-taskbar-app.active').click();
  await expect(displayName).toHaveValue('La direction');
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click();
  await expect(page.locator('.start-menu .start-app:has([data-app="mail"])')).toBeEnabled();
});

test('a minimized incident stays actionable after the former local duration', async ({ page }) => {
  await page.clock.install();
  await page.route('**/kiosk-config.json', (route) =>
    route.fulfill({ json: { ...config, challengeSeconds: 10, defaultCalmMode: false } }),
  );
  await page.goto('./');
  await enter(page);
  await openNext(page, 'incident', false);
  await page.getByRole('button', { name: 'Couper le réseau du poste', exact: true }).click();
  await page.getByRole('button', { name: 'Réduire la fenêtre', exact: true }).click();
  await expect(page.locator('#session-main')).toBeVisible();
  await page.clock.fastForward(11_000);
  await page.locator('.os-taskbar-app.active').click();
  await expect(page.locator('[data-challenge="incident"][data-step="notify"]')).toBeVisible();
  await expect(page.locator('.action-dock [role="timer"]')).toHaveCount(0);
  await expect(page.locator('.feedback-card')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Les équipes de sécurité informatique', exact: false })
    .click();
  await expect(page.locator('.feedback-card')).toBeVisible();
});

test('free exploration shows an ambient event and practice lock can be resumed', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('./');
  await enter(page);
  await page.clock.fastForward(config.eventIntervalSeconds * 1_000);
  await expect(page.locator('.ambient-notice')).toBeVisible();
  const notice = await page.locator('.ambient-notice').boundingBox();
  expect(notice!.x + notice!.width).toBeGreaterThan(page.viewportSize()!.width - 60);
  expect(notice!.y).toBeGreaterThan(page.viewportSize()!.height / 2);
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click();
  await page.getByRole('button', { name: 'Verrouiller la session simulée' }).click();
  await expect(page.getByRole('button', { name: 'Reprendre la simulation' })).toBeVisible();
  await page.getByRole('button', { name: 'Reprendre la simulation' }).click();
  await expect(page.getByRole('button', { name: 'Démarrer', exact: true })).toBeVisible();
});

test('accessibility scan covers login, desktop, scenario and guide', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible();
  await expectNoAxeViolations(page);
  await enter(page);
  await expectNoAxeViolations(page);
  await openNext(page, 'usb');
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Réduire la fenêtre', exact: true }).click();
  await page.getByRole('button', { name: 'Un coup de pouce', exact: true }).first().click();
  await expectNoAxeViolations(page);
});

test('accessibility scan covers the mail knowledge check', async ({ page }) => {
  await page.goto('./');
  await signIn(page);
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Explorer le bureau' }).click();
  await openNext(page, 'mail');
  await page.getByRole('button', { name: 'Mon compte' }).click();
  await page
    .getByRole('button', { name: 'Créer un secret unique avec le gestionnaire approuvé' })
    .click();
  await page.getByText('Tester ce réflexe').click();
  await expectNoAxeViolations(page);
  await answerKnowledge(page, 'password', 0, 'Exact.');
  await expectNoAxeViolations(page);
});

test('native browser actions precede the drawer and MFA choices are immediately available', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('./');
  await enter(page);
  await page.getByRole('button', { name: 'Ouvrir Portail partagé', exact: true }).click();
  const browser = page.locator('[data-challenge="web"]');
  await expect(browser.locator('.choice-button')).toHaveCount(0);
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);
  await expect(page.getByLabel('Adresse fictive du site')).toHaveValue(
    'https://organisation.example.documents-securises.example',
  );
  await expect(
    page.getByRole('button', { name: `${fr.web.bookmark} · ${fr.web.knownDomain}`, exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/previews/browser.png' });
  await page.getByRole('button', { name: 'Que faire ?', exact: true }).click();
  await expect(page.locator('.action-dock-panel')).toBeVisible();
  await expect(page.getByLabel('Adresse fictive du site')).toBeInViewport({ ratio: 1 });
  const bounds = await page.locator('.os-window').boundingBox();
  const panel = await page.locator('.action-dock-panel').boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThan(panel!.x);
  await page.screenshot({ path: 'test-results/previews/browser-actions.png' });
  await page.getByRole('button', { name: 'Replier les actions du jeu' }).click();
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);
  await openNext(page, 'mfa');
  await expect(page.locator('.device-shell')).toBeVisible();
  await expect(page.getByText(fr.mfa.subtitle, { exact: true })).toBeVisible();
  await expect(page.locator('.os-window')).toHaveCount(0);
  const phone = await page.locator('.mfa-device').boundingBox();
  expect(phone!.height / phone!.width).toBeGreaterThanOrEqual(1.6);
  await expect(page.locator('.mfa-device')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.action-dock-panel')).toBeVisible();
  await expect(page.locator('.action-dock-panel .choice-button')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/previews/phone.png' });
  await expectNoAxeViolations(page);
});

test('incident network control isolates before opening the reporting choices', async ({ page }) => {
  await page.goto('./');
  await enter(page);
  await openNext(page, 'incident', false);
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);

  await page.getByRole('button', { name: 'Couper le réseau du poste' }).click();
  await expect(page.locator('[data-challenge="incident"][data-step="notify"]')).toBeVisible();
  await expect(
    page.getByText('Bravo, le poste est isolé. Quelle action faites-vous maintenant ?'),
  ).toBeVisible();
  await expect(page.locator('.action-dock-panel')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Les équipes de sécurité informatique' }),
  ).toBeVisible();
});

test('mail keeps inspection available and can report natively to configured support', async ({
  page,
}) => {
  await page.goto('./');
  await enter(page);
  await openNext(page, 'mail', false);
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);

  await page.getByRole('button', { name: 'Voir l’adresse complète' }).click();
  await expect(page.getByText('Adresse réelle')).toBeVisible();
  await expect(page.locator('.mail-report-action')).toContainText(config.supportLabel);
  await page.getByRole('button', { name: 'Transmettre au support SSI', exact: true }).click();
  await expect(page.locator('.feedback-card')).toContainText(fr.mail.reported);
});

test('left Start menu opens updates and keeps their status for the session', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('./');
  await enter(page);
  const start = page.getByRole('button', { name: 'Démarrer', exact: true });
  await expect(start).toContainText('ShutterOS');
  const startBounds = await start.boundingBox();
  const organization = await page.locator('.desktop-organization').boundingBox();
  const guide = await page.locator('.companion-dock').boundingBox();
  const watermark = await page.locator('.desktop-watermark').boundingBox();
  expect(startBounds!.x).toBeLessThan(60);
  expect(startBounds!.y).toBeGreaterThan(640);
  expect(organization!.x).toBeLessThan(60);
  expect(organization!.y).toBeLessThan(60);
  expect(guide!.x).toBeGreaterThan(1150);
  expect(guide!.y).toBeLessThan(130);
  expect(Math.abs(watermark!.x + watermark!.width / 2 - 640)).toBeLessThan(30);
  await expect(page.locator('.os-taskbar')).not.toContainText('Exploration libre');
  await start.click();
  await expect(page.locator('.start-trigger svg')).toBeVisible();
  await page.screenshot({ path: 'test-results/previews/start-menu.png' });
  await page.getByRole('button', { name: 'Mises à jour', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mises à jour', exact: true })).toBeVisible();
  await expect(page.locator('.start-menu')).toHaveCount(0);
  await expect(page.locator('.action-dock-panel, .companion-dock')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Accepter la mise à jour prévue par le Service Informatique' })
    .click();
  await expect(page.getByRole('status')).toContainText('Mise à jour planifiée');
  await expectNoAxeViolations(page);
  await page.screenshot({ path: 'test-results/previews/updates.png' });
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await start.click();
  await page.getByRole('button', { name: 'Mises à jour', exact: true }).click();
  await expect(page.locator('.start-menu')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Mise à jour planifiée');
  await page.getByRole('button', { name: 'Quitter la session', exact: true }).click();
  await page.getByRole('button', { name: 'Quitter et effacer ma progression' }).click();
  await enter(page);
  await start.click();
  await page.getByRole('button', { name: 'Mises à jour', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: 'Accepter la mise à jour prévue par le Service Informatique',
    }),
  ).toBeVisible();
});

test('leaving asks for confirmation, preserves a cancelled draft, and cannot stop expiry', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('./');
  await enter(page);
  await openNext(page, 'spoof');
  const name = page.getByLabel('Nom affiché');
  await name.fill('Camille — brouillon en cours');
  await page.getByRole('button', { name: 'Quitter la session', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Quitter cette partie ?' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuer à jouer' })).toBeFocused();
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Continuer à jouer' }).click();
  await expect(name).toHaveValue('Camille — brouillon en cours');
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click();
  await page
    .locator('.start-menu')
    .getByRole('button', { name: 'Quitter la session', exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(name).toHaveValue('Camille — brouillon en cours');
  await page.getByRole('button', { name: 'Quitter la session', exact: true }).click();
  await page.clock.fastForward(sessionDurationMs + 100);
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Le temps est écoulé.', { exact: false })).toBeVisible();
});

test('application launchers do not advertise unavailable navigation during feedback', async ({
  page,
}) => {
  await page.goto('./');
  await signIn(page);
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click();
  await expect(page.locator('.start-menu .start-app')).toHaveCount(7);
  for (const app of await page.locator('.start-menu .start-app').all())
    await expect(app).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Explorer le bureau' }).click();
  await openNext(page, 'usb');
  await page.getByRole('button', { name: 'Passer par la station blanche', exact: false }).click();
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click();
  for (const app of await page.locator('.start-menu .start-app').all())
    await expect(app).toBeDisabled();
  await page.keyboard.press('Escape');
  await advance(page);
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click();
  await expect(page.locator('.start-menu .start-app:has([data-app="usb"])')).toBeDisabled();
  await expect(page.locator('.start-menu .start-app:has([data-app="mail"])')).toBeEnabled();
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 960, height: 540 },
]) {
  test(`all applications keep reachable decisions at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await enter(page);
    for (const icon of await page.locator('.desktop-icon').all()) {
      await expect(icon).toBeInViewport({ ratio: 1 });
    }
    for (const id of ['usb', 'incident', 'mail', 'web', 'mfa']) {
      await openNext(page, id, false);
      if (id === 'mfa') {
        const phone = await page.locator('.mfa-device').boundingBox();
        expect(phone!.height / phone!.width).toBeGreaterThanOrEqual(1.6);
      }
      const panel = page.locator('.action-dock-panel');
      if (id !== 'mfa') {
        await page.getByRole('button', { name: 'Que faire ?', exact: true }).click();
      }
      await expect(panel).toBeVisible();
      const bounds = await panel.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height - 64);
      const lastChoice = panel.locator('.choice-button').last();
      await lastChoice.focus();
      await expect(lastChoice).toBeFocused();
      // Native focus scrolling can leave a fractional border pixel clipped.
      // Require the control to be reachable, without a pixel-perfect scroll gate.
      await expect(lastChoice).toBeInViewport({ ratio: 0.99 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
      await expectNoAxeViolations(page);
      await page.getByRole('button', { name: 'Replier les actions du jeu' }).click();
      await expect(page.getByRole('button', { name: 'Que faire ?', exact: true })).toBeFocused();
    }
    await openNext(page, 'spoof');
    await page.getByRole('button', { name: 'Envoyer dans la simulation' }).focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('button', { name: 'J’ai compris : je vérifie l’identité' }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
    await openNext(page, 'ai', false);
    await page.getByRole('button', { name: fr.ai.connect, exact: true }).click();
    await page.getByRole('radio', { name: fr.ai.masked, exact: true }).check();
    const send = page.getByRole('button', { name: fr.ai.send, exact: true });
    await send.focus();
    await expect(send).toBeInViewport({ ratio: 0.99 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await expectNoAxeViolations(page);
    await page.screenshot({ path: `test-results/previews/ai-${viewport.width}.png` });
  });
}

test('missing notices do not block play and About preserves the current draft', async ({
  page,
}) => {
  await page.route('**/THIRD-PARTY-NOTICES.txt', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page.goto('./');
  await enter(page);
  await openNext(page, 'spoof');
  await page.getByLabel('Nom affiché').fill('Camille — en cours');
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click();
  await page.getByRole('button', { name: 'À propos de ShutterOS', exact: true }).click();
  await page.getByText('Licences tierces et mentions', { exact: true }).click();
  await expect(
    page
      .locator('.about-screen details[open]')
      .getByText('Les mentions complètes ne sont pas disponibles dans cette session.'),
  ).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByLabel('Nom affiché')).toHaveValue('Camille — en cours');
});

test('local portrait SVG keeps its ratio and organisation text stays escaped', async ({ page }) => {
  const label = '<img src=x onerror=alert(1)>';
  await page.route('**/kiosk-config.json', (route) =>
    route.fulfill({
      json: { ...config, organizationName: label, organizationLogo: 'logo-organisation.svg' },
    }),
  );
  await page.route('**/logo-organisation.svg', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="240" viewBox="0 0 80 240"><rect width="80" height="240" fill="#ffffff"/></svg>',
    }),
  );
  await page.goto('./');
  const logo = page.locator('.organization-logo');
  await expect(logo).toBeVisible();
  await expect(page.getByText(label, { exact: true })).toBeVisible();
  const box = await logo.boundingBox();
  expect(box!.height).toBeLessThanOrEqual(54);
  expect(box!.width / box!.height).toBeCloseTo(1 / 3, 2);
  await enter(page);
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', 'logo-organisation.svg');
  expect(await page.locator('img').count()).toBe(1);
});

test('Start no longer offers calm mode and legacy timer keys are ignored', async ({ page }) => {
  await page.clock.install();
  await page.route('**/kiosk-config.json', (route) =>
    route.fulfill({ json: { ...config, challengeSeconds: 10, defaultCalmMode: false } }),
  );
  await page.goto('./');
  await signIn(page);
  await expect(page.getByText(fr.intro.guessedDescription)).toBeVisible();
  await page.getByRole('button', { name: fr.intro.start }).click();
  await page.getByRole('button', { name: fr.os.start, exact: true }).click();
  await expect(page.locator('.start-menu')).toBeVisible();
  await expect(page.locator('.start-menu input[type="checkbox"]')).toHaveCount(0);
});

test('both deliveries announce English and render a fictional MFA location', async ({ page }) => {
  for (const url of ['./', portable]) {
    await page.goto(url);
    await enter(page);
    await openNext(page, 'mfa');
    await expect(page.getByText('Karvalsk, Lornavique')).toBeVisible();
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByText('Karvalsk, Lornavica')).toBeVisible();
    await expectNoAxeViolations(page);
  }
});

test('unbranded demo follows the selected language', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.organization-brand')).toHaveCount(1);
  await expect(page.locator('.organization-brand')).toContainText('Votre organisation');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.locator('.organization-brand')).toContainText('Your organization');
});

for (const width of [390, 960, 1440]) {
  test(`joint organisations preserve independent logos at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route('**/kiosk-config.json', (route) =>
      route.fulfill({
        json: {
          ...config,
          organizationName: 'Example Prefecture',
          organizationLogo: 'logo-organisation.svg',
          partnerOrganizationName: 'Example Department Council',
          partnerOrganizationLogo: 'logo-partner-organisation.svg',
        },
      }),
    );
    await page.route('**/logo-organisation.svg', (route) =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="240" viewBox="0 0 80 240"><rect width="80" height="240" fill="white"/></svg>',
      }),
    );
    await page.route('**/logo-partner-organisation.svg', (route) =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="60" viewBox="0 0 300 60"><rect width="300" height="60" fill="white"/></svg>',
      }),
    );
    await page.goto('./');
    const brands = page.locator('.organization-brand');
    await expect(brands).toHaveCount(2);
    for (const [index, ratio] of [1 / 3, 5].entries()) {
      const logo = brands.nth(index).locator('img');
      await expect(logo).toBeVisible();
      const box = await logo.boundingBox();
      expect(box!.width / box!.height).toBeCloseTo(ratio, 2);
      await expect(brands.nth(index)).toBeInViewport({ ratio: 1 });
    }
    await page.screenshot({ path: `test-results/previews/partners-login-${width}.png` });
    await enter(page);
    await expect(brands).toHaveCount(2);
    for (const brand of await brands.all()) await expect(brand).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `test-results/previews/partners-desktop-${width}.png` });
    const group = await page.locator('.organization-group').boundingBox();
    const icons = await page.locator('.desktop-icon').first().boundingBox();
    expect(group!.y + group!.height).toBeLessThanOrEqual(icons!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await expectNoAxeViolations(page);
  });
}

test('ejecting the USB drive completes its safe path without opening the quiz', async ({
  page,
}) => {
  await page.goto('./');
  await enter(page);
  await openNext(page, 'usb', false);
  await expect(page.locator('.action-dock-panel')).toHaveCount(0);
  await page
    .locator('.usb-browser')
    .getByRole('button', { name: 'Éjecter la clé', exact: true })
    .click();
  await expect(page.locator('.feedback-card')).toContainText(fr.usb.ejected);
  await expect(page.locator('[data-challenge="incident"]')).toHaveCount(0);
});

test('benign USB items open local previews without recording an infection', async ({ page }) => {
  await page.goto('./');
  await enter(page);
  await openNext(page, 'usb', false);

  const drive = page.locator('.usb-browser');
  // The executable extension is a clue for screen-reader users too.
  await expect(drive.getByRole('button', { name: fr.usb.filename, exact: true })).toBeVisible();
  await drive.getByRole('button', { name: fr.usb.otherFile }).dblclick();
  await expect(drive.getByText(fr.usb.archivePreview)).toBeVisible();
  await expect(page.locator('[data-challenge="usb"]')).toBeVisible();
  await expect(page.locator('.feedback-card')).toHaveCount(0);

  const readme = drive.getByRole('button', { name: fr.usb.readme });
  await readme.focus();
  await page.keyboard.press('Enter');
  await expect(drive.getByText(fr.usb.readmePreview)).toBeVisible();
  await expect(readme).toBeFocused();
  await expect(page.locator('.feedback-card')).toHaveCount(0);
  await drive.getByRole('button', { name: fr.usb.eject, exact: true }).click();
  await expect(page.locator('.feedback-card[data-outcome="safe"]')).toBeVisible();
  await expect(page.locator('.feedback-card')).toContainText(fr.usb.ejected);
  await advance(page);
  await expect(page.locator('[data-challenge="incident"]')).toHaveCount(0);
});

test('global deadline resets a minimized incident even after the former local duration', async ({
  page,
}) => {
  await page.clock.install();
  await page.route('**/kiosk-config.json', (route) =>
    route.fulfill({ json: { ...config, challengeSeconds: 10, defaultCalmMode: false } }),
  );
  await page.goto('./');
  await enter(page);
  await openNext(page, 'incident', false);
  await page.getByRole('button', { name: 'Couper le réseau du poste', exact: true }).click();
  await page.getByRole('button', { name: 'Réduire la fenêtre', exact: true }).click();
  await page.clock.fastForward(sessionDurationMs + 100);
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible();
  await expect(page.getByText('Le temps est écoulé.', { exact: false })).toBeVisible();
});
