import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { COMBINATIONS, SPECIES_BUNDLE, mockMap } from '../fixtures/map';

/** Die Höchsthöhe eines Blatts aus `project/Sheet.dc.html`. */
const SHEET_MAX = 640;

const REPLIES = {
  '/api/species/bundle': SPECIES_BUNDLE,
  '/api/combinations': COMBINATIONS,
  '/api/finds': { items: [], nextCursor: null },
  '/api/markers': { items: [], nextCursor: null },
  '/api/zones': { items: [], nextCursor: null },
};

async function openMap(page: Page): Promise<void> {
  await mockApi(page, REPLIES);
  await mockMap(page);
  await page.goto('/karte');
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
}

test('Reiterwechsel hält den Zustand der Karte', async ({ page }) => {
  await openMap(page);
  await page.getByRole('tab', { name: 'Ebene' }).click();
  await expect(page.getByRole('tab', { name: 'Ebene' })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('navigation').locator('a[href="/arten"]').click();
  await expect(page).toHaveURL(/\/arten$/);
  await page.getByRole('navigation').locator('a[href="/karte"]').click();

  await expect(page.getByRole('tab', { name: 'Ebene' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('KW 40 · 2025')).toBeVisible();
});

test('Reiterwechsel lädt keinen neuen Kartenstil', async ({ page }) => {
  const styleRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('tiles.openfreemap.org')) styleRequests.push(request.url());
  });
  await openMap(page);
  await page.waitForLoadState('networkidle');
  const loaded = styleRequests.length;

  await page.getByRole('navigation').locator('a[href="/arten"]').click();
  await expect(page).toHaveURL(/\/arten$/);
  await page.getByRole('navigation').locator('a[href="/karte"]').click();

  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(styleRequests).toHaveLength(loaded);
});

test('Reiterwechsel setzt die Übergangsart und lädt keinen neuen Kartenstil', async ({ page }) => {
  const styleRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('tiles.openfreemap.org')) styleRequests.push(request.url());
  });
  await openMap(page);
  await page.waitForLoadState('networkidle');
  const loaded = styleRequests.length;

  await page.getByRole('navigation').locator('a[href="/arten"]').click();
  await expect(page).toHaveURL(/\/arten$/);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset['motion']))
    .toBe('tab-forward');

  await page.getByRole('navigation').locator('a[href="/karte"]').click();
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset['motion'])).toBe('tab-back');

  await page.waitForLoadState('networkidle');
  expect(styleRequests).toHaveLength(loaded);
});

test('Wochenwechsel ohne Netz aus dem Speicher des Geräts', async ({ page }) => {
  await openMap(page);
  await expect(page.getByRole('button', { name: /KW 40/ })).toHaveAttribute('aria-pressed', 'true');

  // Kein Netz: die Manifeste liegen schon im Cache, die Leiste bleibt bedienbar.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.locator('app-banner')).toContainText('Keine Verbindung');
  const asked: string[] = [];
  page.on('request', (request) => asked.push(request.url()));

  await page.getByRole('button', { name: /KW 40/ }).press('ArrowLeft');
  await page.getByRole('button', { name: /KW 39/ }).press('ArrowLeft');

  await expect(page.getByRole('button', { name: /KW 38/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('KW 38 · 2025')).toBeVisible();
  expect(asked.filter((url) => url.endsWith('layers.json'))).toHaveLength(0);
});

test('Das Ebenen-Blatt folgt seiner Liste bis zur Höchsthöhe', async ({ page }) => {
  await openMap(page);
  await page.getByRole('tab', { name: 'Ebene' }).click();
  await page.getByRole('button', { name: 'Niederschlag der letzten 4 Wochen' }).first().click();

  const list = page.getByRole('group', { name: 'Ebene' });
  await expect(list).toBeVisible();
  await expect(page.getByRole('button', { name: /Hitzetage der Woche/ })).toBeVisible();

  const sheet = page.getByRole('dialog', { name: 'Karte' });
  const box = await sheet.boundingBox();
  if (box === null) throw new Error('Blatt ohne Fläche.');
  expect(box.height).toBeLessThanOrEqual(SHEET_MAX);
});
