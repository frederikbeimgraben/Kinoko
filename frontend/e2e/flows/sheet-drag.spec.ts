import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { SPECIES_BUNDLE, mockMap } from '../fixtures/map';
import { bundle } from '../fixtures/species';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

const CATALOGUE = bundle([
  {
    slug: 'boletus-edulis',
    name: 'Steinpilz',
    latin: 'Boletus edulis',
    edibility: 'edible',
    cap: ['#6b4423'],
    stem: ['#e8d9b5'],
  },
]);

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

/** Zieht den Griff des offenen Blatts weit nach unten. */
async function pullDown(page: Page): Promise<void> {
  const handle = page.locator('.sheet__handle').first();
  // Das Blatt fährt aus. Der Zeiger wartet, bis es steht.
  await handle.hover();
  const box = await handle.boundingBox();
  if (box === null) throw new Error('Griff fehlt.');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 200, { steps: 8 });
  await page.mouse.move(x, y + 600, { steps: 8 });
  await page.mouse.up();
}

/** Der Reiter Einträge mit einem Marker und angemeldetem Konto. */
async function openEntries(page: Page): Promise<void> {
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
}

test('Artenfilter schließt mit einem Zug am Griff', async ({ page }) => {
  await mockApi(page, { '/api/species/bundle': CATALOGUE });
  await page.goto('/arten');
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Filter' });
  await expect(sheet).toBeVisible();

  await pullDown(page);

  await expect(sheet).toHaveCount(0);
});

test('Einträge-Filter schließt mit einem Zug am Griff', async ({ page }) => {
  await openEntries(page);
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Filter' });
  await expect(sheet).toBeVisible();

  await pullDown(page);

  await expect(sheet).toHaveCount(0);
});

test('Objektblatt schließt mit demselben Zug am Griff', async ({ page }) => {
  await openEntries(page);
  await page.getByRole('tab', { name: 'Marker' }).click();
  const entry = page.getByRole('button').filter({ hasText: 'Alter Fichtenbestand' }).first();
  await expect(entry).toBeVisible();
  await expect(async () => {
    await entry.click();
    await expect(page).toHaveURL(/\/karte$/, { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  const sheet = page.getByRole('dialog', { name: 'Marker' });
  await expect(sheet).toBeVisible();

  await pullDown(page);

  await expect(sheet).toHaveCount(0);
});
