import { expect, test, type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { ROW_PHOTO } from '../fixtures/photos';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { SPECIES_BUNDLE } from '../fixtures/map';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** Ein Board gehört zu einem Gerät und läuft nicht, solange es aussteht. */
function guard(board: string, device: 'phone' | 'desktop'): void {
  test.skip(test.info().project.name !== device, `Board gehört zu ${device}`);
  skipPending(board);
}

/** Die zwei Marker aus dem Board `EntriesMarkers`. */
const MARKERS = {
  items: [
    {
      id: 'marker-eins',
      name: 'Alter Fichtenbestand',
      lat: 48.52,
      lon: 9.05,
      colour: 'blue',
      note: 'Schönbuch',
      visibility: 'private',
      updatedAt: '2026-09-01T08:00:00Z',
      deleted: false,
    },
    {
      id: 'marker-zwei',
      name: 'Parkplatz Nord',
      lat: 48.6,
      lon: 9.1,
      colour: 'brown',
      note: 'Odenwald',
      visibility: 'shared',
      updatedAt: '2026-09-02T08:00:00Z',
      deleted: false,
    },
  ],
  nextCursor: null,
};

/** Ein Viereck mit der gewünschten Fläche, als Rechteck um den Nullpunkt. */
function square(hectares: number): Record<string, unknown> {
  const side = Math.sqrt(hectares * 10_000);
  const degrees = side / 111_320;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [9, 48],
        [9 + degrees / Math.cos((48 * Math.PI) / 180), 48],
        [9 + degrees / Math.cos((48 * Math.PI) / 180), 48 + degrees],
        [9, 48 + degrees],
        [9, 48],
      ],
    ],
  };
}

/** Die zwei Zonen aus dem Board `EntriesZones`. */
const ZONES = {
  items: [
    {
      id: 'zone-eins',
      name: 'Schönbuch Nord',
      colour: 'green',
      polygon: square(42),
      areaHa: 42,
      note: null,
      visibility: 'private',
      updatedAt: '2026-09-01T08:00:00Z',
      deleted: false,
    },
    {
      id: 'zone-zwei',
      name: 'Odenwald Ost',
      colour: 'red',
      polygon: square(18),
      areaHa: 18,
      note: null,
      visibility: 'shared',
      updatedAt: '2026-09-02T08:00:00Z',
      deleted: false,
    },
  ],
  nextCursor: null,
};

const REPLIES = {
  '/api/species/bundle': SPECIES_BUNDLE,
  '/api/markers': MARKERS,
  '/api/zones': ZONES,
  '/api/finds': { items: [], nextCursor: null },
};

async function openEntries(page: Page, signedIn = true): Promise<void> {
  if (signedIn) await mockSignIn(page);
  await mockApi(page, { ...REPLIES, '/api/config': authConfig(BASE) }, { photo: ROW_PHOTO });
  await page.goto('/eintraege');
  await expect(page.getByRole('heading', { name: 'Einträge' })).toBeVisible();
}

test('EntriesMarkers', async ({ page }) => {
  guard('EntriesMarkers', 'phone');
  await openEntries(page);
  await page.getByRole('tab', { name: 'Marker' }).click();
  await expect(page.getByText('Alter Fichtenbestand')).toBeVisible();
  await expectBoard(page, 'EntriesMarkers');
});

test('EntriesZones', async ({ page }) => {
  guard('EntriesZones', 'phone');
  await openEntries(page);
  await page.getByRole('tab', { name: 'Zonen' }).click();
  await expect(page.getByText('Schönbuch Nord')).toBeVisible();
  await expectBoard(page, 'EntriesZones');
});
