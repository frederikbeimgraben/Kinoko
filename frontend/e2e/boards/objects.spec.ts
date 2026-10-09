import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { GROUPS } from '../fixtures/groups';
import { SPECIES_BUNDLE, SPECIES_MANIFEST, mockMap, showDesignMap } from '../fixtures/map';
import { mockValueTile } from '../fixtures/tiles';
import { expectBoard, neutralisePhotos, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** A board belongs to one device and does not run while it is pending. */
function guard(board: string, device: 'phone' | 'wide'): void {
  test.skip(test.info().project.name !== device, `Board gehört zu ${device}`);
  skipPending(board);
}

/** The marker of the board `MarkerSheet`. */
const MARKERS = {
  items: [
    {
      id: 'marker-eins',
      name: 'Alter Fichtenbestand',
      lat: 48.52,
      lon: 9.05,
      colour: 'violet',
      note: 'Guter Steinpilzplatz, Nordhang, immer erst nach Regen nachsehen.',
      visibility: 'private',
      updatedAt: '2026-09-01T08:00:00Z',
      deleted: false,
    },
  ],
  nextCursor: null,
};

/** The find of the board `FindSheet`. */
const FINDS = {
  items: [
    {
      id: 'find-eins',
      ownerId: 'konto-eins',
      lat: 48.5203,
      lon: 9.0511,
      speciesId: '00000000-0000-4000-8000-000000000014',
      foundOn: '2026-09-06',
      count: 3,
      reviewState: 'accepted',
      visibility: 'shared',
      groupId: GROUPS[0].id,
      forTraining: true,
      note: 'Unter Fichten am Weg, drei junge, Kappen noch geschlossen.',
      updatedAt: '2026-09-06T08:00:00Z',
      deleted: false,
    },
  ],
  nextCursor: null,
};

/** The two photos of the board `FindSheet`. */
const PHOTOS = {
  items: [
    { id: 'foto-eins', findId: 'find-eins', state: 'accepted', source: 'own', ownerName: 'Frederik' },
    { id: 'foto-zwei', findId: 'find-eins', state: 'accepted', source: 'own', ownerName: 'Frederik' },
  ],
  nextCursor: null,
};

/** The zone of the board `ZoneEdit`. */
const ZONES = {
  items: [
    {
      id: 'zone-eins',
      name: 'Schönbuch Nord',
      colour: 'green',
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [9, 48.5],
            [9.1, 48.5],
            [9.1, 48.6],
            [9, 48.5],
          ],
        ],
      },
      areaHa: 42,
      note: 'Nordhang, alte Fichten, ab Mitte September.',
      visibility: 'private',
      updatedAt: '2026-09-01T08:00:00Z',
      deleted: false,
    },
  ],
  nextCursor: null,
};

const REPLIES = {
  '/api/species/bundle': SPECIES_BUNDLE,
  '/api/combinations': [],
  '/api/markers': MARKERS,
  '/api/zones': ZONES,
  '/api/finds': FINDS,
  '/api/photos': PHOTOS,
  '/api/zones/zone-eins/value': {
    speciesId: '00000000-0000-4000-8000-000000000014',
    year: 2025,
    week: 40,
    areaMean: 18,
    points: 1240,
    ownFinds: 2,
  },
  '/api/groups': { items: GROUPS },
  '/api/me': { id: 'konto-eins', name: 'Frederik' },
};

/** The manifest of the species with the tile of the find. */
const MANIFEST = { ...SPECIES_MANIFEST, tiles: { zooms: [5, 8], have: { '8': ['134/88'] } } };

/** Goes through the entry list into the sheet of an object. */
async function openObject(page: Page, tab: string, row: string): Promise<void> {
  await mockSignIn(page);
  await mockApi(
    page,
    { ...REPLIES, '/api/config': authConfig(BASE) },
    { photo: { 'foto-eins/list': 'tile-1-72x72.png', 'foto-zwei/list': 'tile-2-72x72.png' } },
  );
  await mockMap(page, { detent: 1 });
  await neutralisePhotos(page);
  await mockValueTile(page, 'boletus-edulis', MANIFEST);
  await page.goto('/eintraege');
  await page.getByRole('button', { name: tab, exact: true }).click();
  const entry = page.getByRole('button').filter({ hasText: row }).first();
  await expect(entry).toBeVisible();
  // Under load, the tap can come before the listener of the row.
  await expect(async () => {
    await entry.click();
    await expect(page).toHaveURL(/\/karte$/, { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
  await expect(page.getByRole('heading', { name: row })).toBeVisible();
}

/** Puts the design map surface on the canvas and compares the page with the board. */
async function board(page: Page, stem: string): Promise<void> {
  await showDesignMap(page);
  await expectBoard(page, stem);
}

test('MapMarkerView', async ({ page }) => {
  guard('MapMarkerView', 'phone');
  await openObject(page, 'Marker', 'Alter Fichtenbestand');
  await board(page, 'MapMarkerView');
});

test('MapFindView', async ({ page }) => {
  guard('MapFindView', 'phone');
  await openObject(page, 'Funde', 'Steinpilz');
  await board(page, 'MapFindView');
});

test('MapDialogObjectDelete', async ({ page }) => {
  guard('MapDialogObjectDelete', 'phone');
  await openObject(page, 'Marker', 'Alter Fichtenbestand');
  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('heading', { name: 'Marker löschen?' })).toBeVisible();
  await board(page, 'MapDialogObjectDelete');
});

test('MapDialogFindDelete', async ({ page }) => {
  guard('MapDialogFindDelete', 'phone');
  await openObject(page, 'Funde', 'Steinpilz');
  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('heading', { name: 'Fund löschen?' })).toBeVisible();
  await board(page, 'MapDialogFindDelete');
});

/** The hook of the app that lets the test set the map exactly. */
interface MapHandle {
  aimAt(x: number, y: number): [number, number];
  showAt(lon: number, lat: number, x: number, y: number, zoom?: number): void;
}

/** The corner where the board `ObjectMenu` shows the menu. */
const MENU_SPOT: readonly [number, number] = [160, 296];

test('ObjectMenu', async ({ page }) => {
  guard('ObjectMenu', 'phone');
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 48.5203, longitude: 9.0511 });
  await mockSignIn(page);
  await mockApi(page, { ...REPLIES, '/api/config': authConfig(BASE) });
  await mockMap(page, { detent: 0 });
  await page.goto('/karte');
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
  await page.waitForFunction(() => 'pilzMap' in window);
  // The marker is below the point where the menu opens.
  await page.evaluate(
    ([lon, lat, x, y]) => {
      (window as unknown as { pilzMap: MapHandle }).pilzMap.showAt(lon, lat, x, y, 14);
    },
    [9.05, 48.52, MENU_SPOT[0], MENU_SPOT[1]] as const,
  );
  await page.waitForTimeout(400);
  await page.mouse.move(MENU_SPOT[0], MENU_SPOT[1]);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  await expect(page.getByRole('menu')).toBeVisible();
  await showDesignMap(page);
});

/** Goes from the sheet to the form of the object. */
async function edit(page: Page, heading: string): Promise<void> {
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
}

test('MapMarkerEdit', async ({ page }) => {
  guard('MapMarkerEdit', 'phone');
  await openObject(page, 'Marker', 'Alter Fichtenbestand');
  await edit(page, 'Marker bearbeiten');
  await board(page, 'MapMarkerEdit');
});

test('MapZoneView', async ({ page }) => {
  guard('MapZoneView', 'phone');
  await openObject(page, 'Zonen', 'Schönbuch Nord');
  await board(page, 'MapZoneView');
});

test('MapDesktopZoneView', async ({ page }) => {
  guard('MapDesktopZoneView', 'wide');
  await page.context().grantPermissions(['geolocation']);
  await openObject(page, 'Zonen', 'Schönbuch Nord');
  await showDesignMap(page);
  await expectBoard(page, 'MapDesktopZoneView');
});

test('MapZoneEdit', async ({ page }) => {
  guard('MapZoneEdit', 'phone');
  await openObject(page, 'Zonen', 'Schönbuch Nord');
  await edit(page, 'Zone bearbeiten');
  await board(page, 'MapZoneEdit');
});

test('MapFindEdit', async ({ page }) => {
  guard('MapFindEdit', 'phone');
  await openObject(page, 'Funde', 'Steinpilz');
  await edit(page, 'Fund bearbeiten');
  // The board shows the fields as the person changes them: a new date, no count and no note.
  await page.locator('input[type="date"]').fill('2026-09-09');
  await page.getByRole('spinbutton').fill('');
  await page.locator('textarea').fill('');
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    const active: Element | null = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
  await board(page, 'MapFindEdit');
});
