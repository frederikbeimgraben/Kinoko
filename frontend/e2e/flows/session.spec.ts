import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/test';
import { mockApi } from '../fixtures/api';
import { ISSUER, authConfig, mockSignIn, mockSignedOut } from '../fixtures/auth';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** The time that the session check stays without an answer. */
const SLOW_MS = 3000;

const MEMORY_KEY = 'pilzkarte.session.v1';

const MEMORY = JSON.stringify({ name: 'Frederik', permissions: [] });

async function rememberSession(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      // Only the window, not the iframe of the silent renewal.
      if (window.top === window) window.localStorage.setItem(key, value);
    },
    [MEMORY_KEY, MEMORY],
  );
}

async function openMap(page: Page, delayMs = 0): Promise<void> {
  await mockSignIn(page, delayMs);
  await mockApi(page, { '/api/config': authConfig(BASE) });
  await page.goto('/karte');
}

test('zeigt bei offener Sitzung ein Skelett und nie den Gast', async ({ page }) => {
  await openMap(page, SLOW_MS);

  const avatar = page.getByRole('button', { name: 'Konto' });
  await expect(avatar).toBeVisible();
  await expect(avatar.locator('app-skeleton')).toBeVisible();
  await expect(avatar).toHaveText('');
  // The map stays usable while the check runs.
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.getByRole('link', { name: 'Arten' }).click();
  await expect(page).toHaveURL(/\/arten$/);
});

test('zeigt die Initiale, sobald die Prüfung antwortet', async ({ page }) => {
  await openMap(page);

  await expect(page.getByRole('button', { name: 'Konto von Frederik' })).toHaveText('F');
});

test('zeigt den Stand aus dem Gerät sofort', async ({ page }) => {
  await rememberSession(page);

  await openMap(page, SLOW_MS);

  const avatar = page.getByRole('button', { name: 'Konto von Frederik' });
  await expect(avatar).toHaveText('F');
  await expect(avatar.locator('app-skeleton')).toHaveCount(0);
});

test('räumt den Stand weg, wenn die Prüfung ihn nicht bestätigt', async ({ page }) => {
  await rememberSession(page);
  await mockSignedOut(page);
  await mockApi(page, { '/api/config': authConfig(BASE) });
  await page.goto('/karte');

  // A guest has no initial: the avatar shows the person icon.
  const avatar = page.getByRole('button', { name: 'Konto', exact: true });
  await expect(avatar.locator('app-svg-icon')).toBeVisible();
  await expect(avatar).toHaveText('');
  expect(await page.evaluate((key) => window.localStorage.getItem(key), MEMORY_KEY)).toBeNull();
});

test('behält die Sitzung, wenn die Prüfung am Netz scheitert', async ({ page }) => {
  await rememberSession(page);
  await mockSignIn(page);
  await mockApi(page, { '/api/config': authConfig(BASE) });
  // The SSO is not reachable. This does not tell if the session exists.
  await page.route(`${ISSUER}/.well-known/openid-configuration`, (route) => route.abort());
  await page.goto('/karte');

  const avatar = page.getByRole('button', { name: 'Konto von Frederik' });
  await expect(avatar).toHaveText('F');
  expect(await page.evaluate((key) => window.localStorage.getItem(key), MEMORY_KEY)).not.toBeNull();
});

test('holt die Sitzung beim nächsten Sichtbarkeitswechsel zurück', async ({ page }) => {
  await rememberSession(page);
  await mockSignIn(page);
  await mockApi(page, { '/api/config': authConfig(BASE) });
  let reachable = false;
  await page.route(`${ISSUER}/.well-known/openid-configuration`, async (route) => {
    if (!reachable) {
      await route.abort();
      return;
    }
    await route.fallback();
  });
  await page.goto('/karte');
  await expect(page.getByRole('button', { name: 'Konto von Frederik' })).toHaveText('F');

  reachable = true;
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expect(page.getByRole('navigation', { name: 'Hauptbereiche' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Konto von Frederik' })).toHaveText('F');
});

test('die Reiterleiste kehrt nach der Rückkehr vom SSO zurück', async ({ page }) => {
  await mockSignedOut(page);
  await mockApi(page, { '/api/config': authConfig(BASE) });
  await page.goto('/konto');
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();

  await mockSignIn(page);
  /** The silent sign-in can come before the click. Both paths end signed in. */
  await page
    .getByRole('button', { name: 'Anmelden' })
    .click({ timeout: 5_000 })
    .catch(() => undefined);

  await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
  await expect(page).toHaveURL(/\/konto$/);
  await expect(page.getByRole('navigation', { name: 'Hauptbereiche' })).toBeHidden();

  await page.goto('/karte');
  await expect(page.getByRole('navigation', { name: 'Hauptbereiche' })).toBeVisible();
});
