import { expect, test } from '../../fixtures/test';
import { type Locator, type Page } from '@playwright/test';
import { mockApi } from '../../fixtures/api';
import { authConfig, mockSignIn } from '../../fixtures/auth';
import { MARKERS, SHARED_FINDS, SPECIES_BUNDLE, ZONES, mockMap } from '../../fixtures/map';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** The width of the modal and of the columns at its left, from the boards. */
const MODAL_WIDTH = 480;
/** The X is 14 px from the edge. The modal border adds one pixel. */
const CLOSE_INSET = 15;
const RAIL = 96;
/** The first marker of the double. */
const MARKER = 'marker 0';
/** The kit pane of each tab: `list` on the entries tab, `panel` on the map tab. */
const COLUMN: Readonly<Record<string, number>> = { '/eintraege': 520, '/karte': 420 };

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

/** Checks the width, the centre over the map area and the X of the modal. */
async function expectCentredModal(page: Page, dialog: Locator): Promise<void> {
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveClass(/sheet--modal/);
  const box = await dialog.boundingBox();
  if (box === null) throw new Error('Modal ohne Fläche.');
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('Kein Fenster.');

  expect(Math.round(box.width)).toBe(MODAL_WIDTH);
  const column = COLUMN[new URL(page.url()).pathname] ?? 0;
  expect(Math.round(box.x + box.width / 2)).toBe(Math.round((RAIL + column + viewport.width) / 2));

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
  // The empty state renders again until the list is complete.
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
