import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { SPECIES_BUNDLE, mockMap } from '../fixtures/map';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

const MARKERS = {
  items: [
    {
      id: 'marker-eins',
      name: 'Alter Fichtenbestand',
      lat: 48.52,
      lon: 9.05,
      colour: 'blue',
      note: 'Nordhang',
      visibility: 'private',
      updatedAt: '2026-09-01T08:00:00Z',
      deleted: false,
    },
  ],
  nextCursor: null,
};

/** Geht über die Liste der Einträge in das Blatt des Markers. */
async function openMarker(page: Page): Promise<void> {
  await mockSignIn(page);
  await mockApi(page, {
    '/api/config': authConfig(BASE),
    '/api/species/bundle': SPECIES_BUNDLE,
    '/api/combinations': [],
    '/api/markers': MARKERS,
    '/api/zones': { items: [], nextCursor: null },
    '/api/finds': { items: [], nextCursor: null },
  });
  await mockMap(page);
  await page.goto('/eintraege');
  await page.getByRole('tab', { name: 'Marker' }).click();
  const entry = page.getByRole('button').filter({ hasText: 'Alter Fichtenbestand' }).first();
  await expect(entry).toBeVisible();
  await expect(async () => {
    await entry.click();
    await expect(page).toHaveURL(/\/karte$/, { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: 'Alter Fichtenbestand' })).toBeVisible();
}

test('Das Objektblatt lässt die Reiterleiste frei', async ({ page }) => {
  await openMarker(page);

  const bar = page.getByRole('navigation');
  const tab = bar.locator('a[href="/arten"]');
  await expect(tab).toBeVisible();

  const sheet = page.getByRole('dialog', { name: 'Marker', exact: true });
  // Das Blatt fährt ein; gemessen wird sein Ruhestand.
  await expect(async () => {
    const sheetBox = await sheet.boundingBox();
    const barBox = await bar.boundingBox();
    if (sheetBox === null || barBox === null) throw new Error('Blatt oder Leiste ohne Fläche.');
    expect(Math.round(sheetBox.y + sheetBox.height)).toBeLessThanOrEqual(Math.round(barBox.y) + 1);
    expect(sheetBox.y).toBeGreaterThan(0);
  }).toPass({ timeout: 5000 });

  await tab.click();
  await expect(page).toHaveURL(/\/arten$/);
});

test('Der Dialog legt seine Abdunkelung über das Blatt', async ({ page }) => {
  await openMarker(page);
  const sheet = page.getByRole('dialog', { name: 'Marker', exact: true });

  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('heading', { name: 'Marker löschen?' })).toBeVisible();

  const onTop = await sheet.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const x = Math.round(box.x + 8);
    const y = Math.round(box.y + box.height - 8);
    return document.elementFromPoint(x, y)?.className ?? '';
  });
  expect(onTop).toContain('confirm__scrim');
});

test('Escape schließt nur den Dialog, nicht das Blatt darunter', async ({ page }) => {
  await openMarker(page);

  await page.getByRole('button', { name: 'Löschen' }).click();
  const question = page.getByRole('heading', { name: 'Marker löschen?' });
  await expect(question).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(question).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Alter Fichtenbestand' })).toBeVisible();
});

test('Zurück schließt erst das Blatt, dann die Seite', async ({ page }) => {
  await openMarker(page);

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Alter Fichtenbestand' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/karte$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/eintraege$/);
});
