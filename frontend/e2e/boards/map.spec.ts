import { expect, test, type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';
import {
  BOARD_FACTORS,
  COMBINATIONS,
  SPECIES_BUNDLE,
  mockMap,
  showMapImage,
  type BoardState,
} from '../fixtures/map';
import { expectBoard, skipPending } from './board';

const BASE = 'http://127.0.0.1:4400';

/** Ein Board gehört zu einem Gerät und läuft nicht, solange es aussteht. */
function guard(board: string, device: 'phone' | 'wide'): void {
  test.skip(test.info().project.name !== device, `Board gehört zu ${device}`);
  skipPending(board);
}

/** Die Antworten des Vertrags, die die Karte braucht. */
const REPLIES = {
  '/api/species/bundle': SPECIES_BUNDLE,
  '/api/combinations': COMBINATIONS,
  '/api/funde': { eintraege: [], gesamt: 0 },
  '/api/marker': { eintraege: [], gesamt: 0 },
  '/api/zonen': { eintraege: [], gesamt: 0 },
};

async function openMap(
  page: Page,
  state: BoardState = {},
  factors = '',
  image = 'map-stein.png',
): Promise<void> {
  await mockApi(page, REPLIES);
  await mockMap(page, state, factors);
  await page.goto('/karte');
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
  if (image !== '') await showMapImage(page, image);
}

/** Dieselbe Karte, aber mit Konto: Speichern fragt dann nicht erst nach. */
async function openSignedIn(page: Page, factors = ''): Promise<void> {
  await mockSignIn(page);
  await mockApi(page, { ...REPLIES, '/api/config': authConfig(BASE) });
  await mockMap(page, { view: 'combination', detent: 2 }, factors);
  await page.goto('/karte');
  await expect(page.getByRole('button', { name: 'Speichern' })).toBeVisible();
  await showMapImage(page, 'map-schnitt.png');
}

/** Speichern führt ohne Konto zuerst durch die Anmeldung. */
async function askForName(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Speichern' }).first().click();
  const signIn = page.getByRole('button', { name: /beimgraben\.net/ });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
    await page.getByRole('button', { name: 'Speichern' }).first().click();
  }
}

test('Map', async ({ page }) => {
  guard('Map', 'phone');
  await openMap(page);
  await expectBoard(page, 'Map');
});

test('MapCollapsed', async ({ page }) => {
  guard('MapCollapsed', 'phone');
  await openMap(page, { detent: 0 });
  await expectBoard(page, 'MapCollapsed');
});

test('MapLayersButton', async ({ page }) => {
  guard('MapLayersButton', 'phone');
  await openMap(page, { detent: 0 });
  await page.getByRole('button', { name: 'Ebenen' }).click();
  await expectBoard(page, 'MapLayersButton');
});

test('LayerTab', async ({ page }) => {
  guard('LayerTab', 'phone');
  await openMap(page, { view: 'layer' }, '', 'map-regen.png');
  await expectBoard(page, 'LayerTab');
});

test('CombinationTab', async ({ page }) => {
  guard('CombinationTab', 'phone');
  await openMap(page, { view: 'combination' }, BOARD_FACTORS, 'map-schnitt.png');
  await expectBoard(page, 'CombinationTab');
});

test('Factor', async ({ page }) => {
  guard('Factor', 'phone');
  await openMap(page, { view: 'combination', detent: 2 }, BOARD_FACTORS, 'map-stein.png');
  await page.getByRole('button', { name: '≥ 80 mm' }).click();
  await expectBoard(page, 'Factor');
});

test('SpeciesChooser', async ({ page }) => {
  guard('SpeciesChooser', 'phone');
  await openMap(page);
  await page.getByRole('button', { name: 'Steinpilz' }).click();
  await expectBoard(page, 'SpeciesChooser');
});

test('FactorPicker', async ({ page }) => {
  guard('FactorPicker', 'phone');
  await openMap(page, { view: 'combination', detent: 2 }, BOARD_FACTORS, 'map-stein.png');
  await page.getByRole('button', { name: 'Faktor hinzufügen' }).click();
  await expectBoard(page, 'FactorPicker');
});

test('CombinationSave', async ({ page }) => {
  guard('CombinationSave', 'phone');
  await openSignedIn(page, BOARD_FACTORS);
  await askForName(page);
  await expect(page.getByRole('dialog', { name: 'Kombination speichern' })).toBeVisible();
  await page.getByRole('textbox').fill('Herbst Steinpilz');
  await expectBoard(page, 'CombinationSave');
});

test('Combinations', async ({ page }) => {
  guard('Combinations', 'phone');
  await openSignedIn(page, BOARD_FACTORS);
  await page.getByRole('button', { name: 'Kombination', exact: true }).click();
  await expectBoard(page, 'Combinations');
});

test('MapOffline', async ({ page }) => {
  guard('MapOffline', 'phone');
  await openMap(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.getByRole('status')).toContainText('Keine Verbindung');
  await expectBoard(page, 'MapOffline');
});

test('MapSkeleton', async ({ page }) => {
  guard('MapSkeleton', 'phone');
  await mockApi(page, REPLIES);
  await mockMap(page);
  // Ohne Manifest zeigt die Karte ihr Raster; ein Kartenbild gehört nicht dazu.
  await page.route(/\/[a-z0-9_-]+\.json$/, async (route) => {
    await route.fulfill({ status: 404, body: '' });
  });
  await page.goto('/karte');
  await expectBoard(page, 'MapSkeleton');
});

test('MapDesktop', async ({ page }) => {
  guard('MapDesktop', 'wide');
  await openMap(page, {}, '', 'map-desktop-stein.png');
  await expectBoard(page, 'MapDesktop');
});
