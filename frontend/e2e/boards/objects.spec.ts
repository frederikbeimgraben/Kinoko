import { expect, test, type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { SPECIES_BUNDLE, SPECIES_MANIFEST, mockMap, showMapImage } from '../fixtures/map';
import { mockValueTile } from '../fixtures/tiles';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** Die Karte des Boards läuft unter dem Blatt weiter. */
const MAP_HEIGHT = 844;

/** Ein Board gehört zu einem Gerät und läuft nicht, solange es aussteht. */
function guard(board: string, device: 'phone' | 'wide'): void {
  test.skip(test.info().project.name !== device, `Board gehört zu ${device}`);
  skipPending(board);
}

/** Der Marker aus dem Board `MarkerSheet`. */
const MARKERS = {
  items: [
    {
      id: 'marker-eins',
      name: 'Alter Fichtenbestand',
      lat: 48.52,
      lon: 9.05,
      colour: 'blue',
      note: 'Guter Steinpilzplatz, Nordhang, immer erst nach Regen nachsehen.',
      visibility: 'private',
      updatedAt: '2026-09-01T08:00:00Z',
      deleted: false,
    },
  ],
  nextCursor: null,
};

/** Der Fund aus dem Board `FindSheet`. */
const FINDS = {
  items: [
    {
      id: 'find-eins',
      lat: 48.52,
      lon: 9.05,
      speciesId: '00000000-0000-4000-8000-000000000014',
      foundOn: '2026-09-06',
      count: 3,
      reviewState: 'accepted',
      visibility: 'shared',
      note: 'Unter Fichten am Weg, drei junge, Kappen noch geschlossen.',
      updatedAt: '2026-09-06T08:00:00Z',
      deleted: false,
    },
  ],
  nextCursor: null,
};

/** Die zwei Fotos, die das Board `FindSheet` nebeneinander zeigt. */
const PHOTOS = {
  items: [
    { id: 'foto-eins', findId: 'find-eins', state: 'accepted', source: 'own', ownerName: 'Frederik' },
    { id: 'foto-zwei', findId: 'find-eins', state: 'accepted', source: 'own', ownerName: 'Frederik' },
  ],
  nextCursor: null,
};

const REPLIES = {
  '/api/species/bundle': SPECIES_BUNDLE,
  '/api/combinations': [],
  '/api/markers': MARKERS,
  '/api/zones': { items: [], nextCursor: null },
  '/api/finds': FINDS,
  '/api/photos': PHOTOS,
};

/** Das Manifest der Art mit genau der Kachel, die den Fund trägt. */
const MANIFEST = { ...SPECIES_MANIFEST, tiles: { zooms: [5, 8], have: { '8': ['134/88'] } } };

/** Geht über die Liste der Einträge in das Blatt eines Objekts. */
async function openObject(page: Page, tab: string, row: string): Promise<void> {
  await mockSignIn(page);
  await mockApi(
    page,
    { ...REPLIES, '/api/config': authConfig(BASE) },
    { photo: { 'foto-eins/list': 'tile-1-72x72.png', 'foto-zwei/list': 'tile-2-72x72.png' } },
  );
  await mockMap(page, { detent: 1 });
  await mockValueTile(page, 'boletus-edulis', MANIFEST);
  await page.goto('/eintraege');
  await page.getByRole('tab', { name: tab }).click();
  const entry = page.getByRole('button').filter({ hasText: row }).first();
  await expect(entry).toBeVisible();
  // Unter Last kommt der Tipp vor dem Zuhörer der Zeile an.
  await expect(async () => {
    await entry.click();
    await expect(page).toHaveURL(/\/karte$/, { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
  await expect(page.getByRole('heading', { name: row })).toBeVisible();
}

/** Legt das Kartenbild auf und vergleicht dann mit dem Board. */
async function board(page: Page, stem: string): Promise<void> {
  await showMapImage(page, 'map-stein-844.png', MAP_HEIGHT);
  await expectBoard(page, stem);
}

test('MarkerSheet', async ({ page }) => {
  guard('MarkerSheet', 'phone');
  await openObject(page, 'Marker', 'Alter Fichtenbestand');
  await board(page, 'MarkerSheet');
});

test('FindSheet', async ({ page }) => {
  guard('FindSheet', 'phone');
  await openObject(page, 'Funde', 'Steinpilz');
  await board(page, 'FindSheet');
});

test('ObjectDelete', async ({ page }) => {
  guard('ObjectDelete', 'phone');
  await openObject(page, 'Marker', 'Alter Fichtenbestand');
  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('heading', { name: 'Marker löschen?' })).toBeVisible();
  await board(page, 'ObjectDelete');
});

test('FindDelete', async ({ page }) => {
  guard('FindDelete', 'phone');
  await openObject(page, 'Funde', 'Steinpilz');
  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('heading', { name: 'Fund löschen?' })).toBeVisible();
  await board(page, 'FindDelete');
});
