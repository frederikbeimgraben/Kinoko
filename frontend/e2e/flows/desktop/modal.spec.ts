import { expect, test } from '../../fixtures/test';
import { type Locator, type Page } from '@playwright/test';
import { mockApi } from '../../fixtures/api';
import { authConfig, mockSignIn } from '../../fixtures/auth';
import { MARKERS, SHARED_FINDS, SPECIES_BUNDLE, ZONES, mockMap } from '../../fixtures/map';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** The width of the modal and the columns on its left, from the boards. */
const MODAL_WIDTH = 560;
/** The close button is 12 px from the top and the end edge, per `kit.css` `.modal .shead`. */
const CLOSE_INSET = 12;
const CLOSE_SIZE = 48;
const RAIL = 96;
/** The first marker of the mock. */
const MARKER = 'marker 0';
/** The kit pane `list` of the entries tab. The modal centres on the area to its right. */
const LIST = 520;

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

/** Checks the width, the centre above the map area and the close button of the modal. */
async function expectCentredModal(page: Page, dialog: Locator): Promise<void> {
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveClass(/sheet--modal/);
  const box = await dialog.boundingBox();
  if (box === null) throw new Error('Modal ohne Fläche.');
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('Kein Fenster.');

  expect(Math.round(box.width)).toBe(MODAL_WIDTH);
  // On the map tab the modal centres on the window, per `kit.css` `.modal` in the board `MapDesktopFindView`.
  const onMap = new URL(page.url()).pathname === '/karte';
  const centre = onMap ? viewport.width / 2 : (RAIL + LIST + viewport.width) / 2;
  expect(Math.round(box.x + box.width / 2)).toBe(Math.round(centre));

  const close = dialog.locator('.overlay-head__close');
  await expect(close).toBeVisible();
  const closeBox = await close.boundingBox();
  if (closeBox === null) throw new Error('X ohne Fläche.');
  expect(Math.round(closeBox.width)).toBe(CLOSE_SIZE);
  expect(Math.round(closeBox.height)).toBe(CLOSE_SIZE);
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

test('sign-in shows on the desktop as a dialog in the centre of the window', async ({ page }) => {
  await openApp(page, '/eintraege', false);
  const dialog = page.getByRole('dialog', { name: 'Anmelden' });
  // The empty state renders again until the list is complete.
  await expect(async () => {
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(dialog).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });

  // Per the board `MapSignIn`: a dialog of the kit, not a modal sheet.
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  if (box === null || viewport === null) throw new Error('Dialog ohne Fläche.');
  expect(Math.round(box.x + box.width / 2)).toBe(Math.round(viewport.width / 2));
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
