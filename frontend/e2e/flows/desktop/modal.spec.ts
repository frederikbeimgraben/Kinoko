import { expect, test } from '../../fixtures/test';
import { type Locator, type Page } from '@playwright/test';
import { mockApi } from '../../fixtures/api';
import { authConfig, mockSignIn } from '../../fixtures/auth';
import { MARKERS, SHARED_FINDS, SPECIES_BUNDLE, ZONES, mockMap } from '../../fixtures/map';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** Breite des Modals und die Spalten links davon, aus den Boards. */
const MODAL_WIDTH = 480;
/** Das X steht 14 px vom Rand. Der Rahmen des Modals misst einen Punkt mehr. */
const CLOSE_INSET = 15;
const RAIL = 88;
/** Der erste Marker der Attrappe. */
const MARKER = 'marker 0';
const COLUMN = 400;

const REPLIES = {
  '/api/species/bundle': SPECIES_BUNDLE,
  '/api/combinations': [],
  '/api/markers': MARKERS,
  '/api/zones': ZONES,
  '/api/finds': SHARED_FINDS,
};

const EMPTY = { items: [], nextCursor: null };

async function openApp(page: Page, path: string, signedIn = true): Promise<void> {
  if (signedIn) await mockSignIn(page);
  const entries = signedIn
    ? REPLIES
    : { ...REPLIES, '/api/markers': EMPTY, '/api/zones': EMPTY, '/api/finds': EMPTY };
  await mockApi(page, { ...entries, '/api/config': authConfig(BASE) });
  await mockMap(page);
  await page.goto(path);
}

/** Prüft Breite, Mitte über der Kartenfläche und das X des Modals. */
async function expectCentredModal(page: Page, dialog: Locator): Promise<void> {
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveClass(/sheet--modal/);
  const box = await dialog.boundingBox();
  if (box === null) throw new Error('Modal ohne Fläche.');
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('Kein Fenster.');

  expect(Math.round(box.width)).toBe(MODAL_WIDTH);
  expect(Math.round(box.x + box.width / 2)).toBe(Math.round((RAIL + COLUMN + viewport.width) / 2));

  const close = dialog.locator('.sheet__close');
  await expect(close).toBeVisible();
  const closeBox = await close.boundingBox();
  if (closeBox === null) throw new Error('X ohne Fläche.');
  expect(Math.round(closeBox.width)).toBe(32);
  expect(Math.round(closeBox.height)).toBe(32);
  expect(Math.round(box.x + box.width - (closeBox.x + closeBox.width))).toBe(CLOSE_INSET);
  expect(Math.round(closeBox.y - box.y)).toBe(CLOSE_INSET);
}

test('Einträge-Filter steht am Rechner als zentriertes Modal', async ({ page }) => {
  await openApp(page, '/eintraege');
  await page.getByRole('button', { name: 'Filter', exact: true }).click();

  await expectCentredModal(page, page.getByRole('dialog', { name: 'Filter' }));
});

test('Objektblatt steht am Rechner als zentriertes Modal', async ({ page }) => {
  await openApp(page, '/eintraege');
  await page.getByRole('tab', { name: 'Marker' }).click();
  const entry = page.getByRole('button').filter({ hasText: MARKER }).first();
  await expect(entry).toBeVisible();
  await entry.click();

  await expectCentredModal(page, page.getByRole('dialog', { name: 'Marker' }));
});

test('Anmelden steht am Rechner als zentriertes Modal', async ({ page }) => {
  await openApp(page, '/eintraege', false);
  const dialog = page.getByRole('dialog', { name: 'Anmelden' });
  // Der Leerzustand zeichnet neu, bis die Liste steht.
  await expect(async () => {
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(dialog).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });

  await expectCentredModal(page, dialog);
});

test('Der Plus-Knopf lässt den Reiter Einträge stehen', async ({ page }) => {
  await openApp(page, '/eintraege');
  await page.getByRole('tab', { name: 'Marker' }).click();
  const list = page.getByRole('button').filter({ hasText: MARKER }).first();
  await expect(list).toBeVisible();

  await page.locator('.map__add').click();

  await expect(page.getByRole('button', { name: 'Fund melden' })).toBeVisible();
  await expect(list).toBeVisible();
  await expect(page).toHaveURL(/\/eintraege$/);
});
