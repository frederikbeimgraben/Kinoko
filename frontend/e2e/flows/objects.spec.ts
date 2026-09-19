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
  // Unter Last kommt der Tipp vor dem Zuhörer der Zeile an.
  await expect(async () => {
    await entry.click();
    await expect(page).toHaveURL(/\/karte$/, { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: 'Alter Fichtenbestand' })).toBeVisible();
}

test('Das X schließt das Objektblatt, ohne zu löschen', async ({ page }) => {
  await openMarker(page);

  await page.locator('.sheet__close').click();

  await expect(page.getByRole('heading', { name: 'Alter Fichtenbestand' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
});

test('Die Browser-Geste zurück schließt das Objektblatt', async ({ page }) => {
  await openMarker(page);

  await page.goBack();

  await expect(page.getByRole('heading', { name: 'Alter Fichtenbestand' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
});

test('Der Fuß führt in das Formular und wieder zurück', async ({ page }) => {
  await openMarker(page);

  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await expect(page.getByRole('heading', { name: 'Marker bearbeiten' })).toBeVisible();

  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('heading', { name: 'Alter Fichtenbestand' })).toBeVisible();
});

test('Der Fuß löscht nach der Rückfrage', async ({ page }) => {
  await openMarker(page);
  await page.route('**/api/markers/marker-eins', (route) => route.fulfill({ status: 204, body: '' }));

  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('heading', { name: 'Marker löschen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Löschen' }).last().click();

  await expect(page.getByRole('heading', { name: 'Alter Fichtenbestand' })).toHaveCount(0);
});
