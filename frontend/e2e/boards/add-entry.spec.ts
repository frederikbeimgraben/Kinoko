import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { join } from 'node:path';
import { mockApi } from '../fixtures/api';
import { ROW_PHOTO } from '../fixtures/photos';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { GROUPS } from '../fixtures/groups';
import {
  MARKERS,
  SHARED_FINDS,
  SPECIES_BUNDLE,
  ZONES,
  mockMap,
  showDesignMap,
  type DesignMap,
} from '../fixtures/map';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** The day and the location of the boards. */
const FOUND_ON = '2026-09-09';
const PLACE = { latitude: 48.5203, longitude: 9.0511 };

/** A board belongs to one device and does not run while it is pending. */
function guard(board: string, device: 'phone' | 'wide'): void {
  test.skip(test.info().project.name !== device, `Board gehört zu ${device}`);
  skipPending(board);
}

const REPLIES = {
  '/api/species/bundle': SPECIES_BUNDLE,
  '/api/combinations': [],
  '/api/markers': MARKERS,
  '/api/zones': ZONES,
  '/api/finds': SHARED_FINDS,
  '/api/groups': { items: GROUPS },
};

async function openMap(page: Page, clear = false): Promise<void> {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation(PLACE);
  await mockSignIn(page);
  await mockApi(page, { ...REPLIES, '/api/config': authConfig(BASE) }, { photo: ROW_PHOTO });
  await mockMap(page, { detent: 1, clear });
  await page.goto('/karte');
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
  // The boards give the location below the crosshair. The map shows that location.
  await page.getByRole('button', { name: 'Standort' }).click();
  await page.waitForTimeout(800);
}

/** Opens the sheet of the add button. */
async function openActions(page: Page, clear = false): Promise<void> {
  await openMap(page, clear);
  await page.getByRole('button', { name: 'Eintragen' }).click();
  await expect(page.getByRole('button', { name: 'Fund melden' })).toBeVisible();
}

/** Goes through the crosshair into a form. */
async function openForm(page: Page, action: string, confirm: string): Promise<void> {
  await openActions(page);
  await page.getByRole('button', { name: action }).click();
  await page.getByRole('button', { name: confirm }).click();
}

/** Puts the design map surface on the canvas and compares the page with the board. */
async function board(page: Page, stem: string, map: DesignMap = {}): Promise<void> {
  await showDesignMap(page, map);
  await expectBoard(page, stem);
}

/** As `board`, but the zone of the app is drawn over the design map surface. */
async function boardUnder(page: Page, stem: string): Promise<void> {
  await board(page, stem, { under: true });
}

test('MapAdd', async ({ page }) => {
  guard('MapAdd', 'phone');
  await openActions(page);
  await board(page, 'MapAdd');
});

/** Sets the day of the find boards. */
async function setDate(page: Page): Promise<void> {
  await page.locator('input[type="date"]').fill(FOUND_ON);
}

/** Adds the photo of the first tile of the boards. */
async function addPhoto(page: Page): Promise<void> {
  const file = join(test.info().config.rootDir, 'boards/fixtures/tile-1-72x72.png');
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.locator('app-photo-strip img')).toBeVisible();
}

test('MapFindForm', async ({ page }) => {
  guard('MapFindForm', 'phone');
  await openForm(page, 'Fund melden', 'Bestätigen');
  await expect(page.getByRole('heading', { name: 'Fund melden' })).toBeVisible();
  await setDate(page);
  await addPhoto(page);
  await board(page, 'MapFindForm');
});

test('MapFindFormShared', async ({ page }) => {
  guard('MapFindFormShared', 'phone');
  await openForm(page, 'Fund melden', 'Bestätigen');
  await expect(page.getByRole('heading', { name: 'Fund melden' })).toBeVisible();
  await setDate(page);
  await addPhoto(page);
  await page.getByRole('tab', { name: 'Geteilt' }).click();
  await page.getByRole('button', { name: 'Gruppe' }).click();
  await page.getByRole('button', { name: 'Pilzgruppe Karlsruhe' }).click();
  await expect(page.getByText('Pilzgruppe Karlsruhe')).toBeVisible();
  // The board shows the top of the sheet. The choice scrolled it down.
  await page.locator('.form__body').evaluate((body) => {
    body.scrollTo(0, 0);
  });
  await board(page, 'MapFindFormShared');
});

test('MapFindSaving', async ({ page }) => {
  guard('MapFindSaving', 'phone');
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await openForm(page, 'Fund melden', 'Bestätigen');
  await expect(page.getByRole('heading', { name: 'Fund melden' })).toBeVisible();
  await setDate(page);
  await addPhoto(page);
  // The date of the board is after the fixed clock. The clock moves on, so the save check passes.
  await page.clock.setFixedTime(new Date(`${FOUND_ON}T12:00:00Z`));
  // Holds the answer until the screenshot of the busy state is done.
  await page.route('**/api/finds', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await held;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SHARED_FINDS.items[0]),
    });
  });
  await page.getByRole('button', { name: 'Speichern' }).click();
  // The request runs: the button shows the spinner instead of its label.
  await expect(page.locator('.btn.primary[aria-busy="true"]')).toBeVisible();
  await showDesignMap(page);
  await expectBoard(page, 'MapFindSaving', { idle: false });
  release();
});

test('MapMarkerForm', async ({ page }) => {
  guard('MapMarkerForm', 'phone');
  await openForm(page, 'Marker setzen', 'Bestätigen');
  await expect(page.getByRole('heading', { name: 'Marker setzen' })).toBeVisible();
  // The board shows the third colour as selected.
  await page.getByRole('radio').nth(2).click();
  await board(page, 'MapMarkerForm');
});

test('MapZoneForm', async ({ page }) => {
  guard('MapZoneForm', 'phone');
  await openActions(page);
  await page.getByRole('button', { name: 'Zone zeichnen' }).click();
  for (const corner of ZONE_CORNERS.slice(0, 3)) await page.mouse.click(corner[0], corner[1]);
  await page.getByRole('button', { name: 'Fertig' }).click();
  await expect(page.getByRole('heading', { name: 'Zone speichern' })).toBeVisible();
  await board(page, 'MapZoneForm');
});

/** The hook of the app that lets the test set the map exactly. */
interface MapHandle {
  aimAt(x: number, y: number): [number, number];
  showAt(lon: number, lat: number, x: number, y: number, zoom?: number): void;
}

/** The location below a point of the window. */
async function aimAt(page: Page, spot: readonly [number, number]): Promise<[number, number]> {
  return page.evaluate(([x, y]) => (window as unknown as { pilzMap: MapHandle }).pilzMap.aimAt(x, y), spot);
}

/** Pans the map until the location is below the point of the window. */
async function showAt(
  page: Page,
  place: readonly [number, number],
  spot: readonly [number, number],
  zoom?: number,
): Promise<void> {
  await page.evaluate(
    ([lon, lat, x, y, level]) => {
      (window as unknown as { pilzMap: MapHandle }).pilzMap.showAt(lon, lat, x, y, level);
    },
    [place[0], place[1], spot[0], spot[1], zoom] as const,
  );
  await page.waitForTimeout(150);
}

/** The scale of the board `ZoneDraw`: its ring has an area of 42 ha. */
const ZONE_ZOOM = 11.6635;

/** The four corners of the board `ZoneDraw`, in px of the window. */
const ZONE_CORNERS: readonly (readonly [number, number])[] = [
  [250, 343],
  [300, 515],
  [195, 572],
  [120, 438],
];

/** The map of the board has no own objects and no position. */
async function openEmptyMap(page: Page): Promise<void> {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation(PLACE);
  await mockSignIn(page);
  const empty = { items: [], nextCursor: null };
  await mockApi(page, {
    ...REPLIES,
    '/api/markers': empty,
    '/api/zones': empty,
    '/api/finds': empty,
    '/api/config': authConfig(BASE),
  });
  await mockMap(page, { detent: 1, clear: true });
  await page.goto('/karte');
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
  await page.getByRole('button', { name: 'Eintragen' }).click();
  await expect(page.getByRole('button', { name: 'Zone zeichnen' })).toBeVisible();
}

/** The centre of the crosshair in the window. */
async function crosshairAt(page: Page): Promise<[number, number]> {
  const cross = await page.locator('app-crosshair').boundingBox();
  return [(cross?.x ?? 0) + (cross?.width ?? 0) / 2, (cross?.y ?? 0) + (cross?.height ?? 0) / 2];
}

test('FindLocation', async ({ page }) => {
  guard('FindLocation', 'phone');
  await openActions(page);
  await page.getByRole('button', { name: 'Fund melden' }).click();
  await expect(page.getByRole('group', { name: 'Fundort festlegen' })).toBeVisible();
  // The bar changes the padding of the map. Then the location of the board goes below the crosshair again.
  await page.waitForTimeout(600);
  await showAt(page, [PLACE.longitude, PLACE.latitude], await crosshairAt(page), ZONE_ZOOM);
  await expect(page.getByText('48,5203 · 9,0511')).toBeVisible();
  await board(page, 'FindLocation');
});

test('ZoneDraw', async ({ page }) => {
  guard('ZoneDraw', 'phone');
  await openEmptyMap(page);
  await page.getByRole('button', { name: 'Zone zeichnen' }).click();
  // The bar changes the padding of the map. The map moves after it.
  await page.waitForTimeout(600);
  await showAt(page, await aimAt(page, ZONE_CORNERS[0]), ZONE_CORNERS[0], ZONE_ZOOM);
  for (const corner of ZONE_CORNERS) await page.mouse.click(corner[0], corner[1]);
  await boardUnder(page, 'ZoneDraw');
});

/** The scale of the desktop board: its ring also has an area of 42 ha. */
const ZONE_ZOOM_WIDE = 16.14;

/** The corners and the pointer of the board `MapDesktopZoneDraw`, in px of the window. */
const WIDE_CORNERS: readonly (readonly [number, number])[] = [
  [947, 406],
  [1117, 602],
  [760, 667],
  [505, 515],
];
const WIDE_POINTER: readonly [number, number] = [505, 515];

/** Opens a step on the desktop. */
async function openStep(page: Page, action: string): Promise<void> {
  await openEmptyMap(page);
  await page.getByRole('button', { name: action }).click();
}

test('MapDesktopFindLocation', async ({ page }) => {
  guard('MapDesktopFindLocation', 'wide');
  await openStep(page, 'Fund melden');
  await expect(page.locator('app-crosshair')).toBeVisible();
  await board(page, 'MapDesktopFindLocation');
});

test('MapDesktopMarkerLocation', async ({ page }) => {
  guard('MapDesktopMarkerLocation', 'wide');
  await openStep(page, 'Marker setzen');
  await expect(page.locator('app-crosshair')).toBeVisible();
  await board(page, 'MapDesktopMarkerLocation');
});

test('MapDesktopZoneDraw', async ({ page }) => {
  guard('MapDesktopZoneDraw', 'wide');
  await openStep(page, 'Zone zeichnen');
  await showAt(page, await aimAt(page, WIDE_CORNERS[0]), WIDE_CORNERS[0], ZONE_ZOOM_WIDE);
  for (const corner of WIDE_CORNERS) await page.mouse.click(corner[0], corner[1]);
  await page.mouse.move(WIDE_POINTER[0], WIDE_POINTER[1]);
  await expect(page.getByText(/4 Eckpunkte/)).toBeVisible();
  await boardUnder(page, 'MapDesktopZoneDraw');
});

test('MapDesktopAdd', async ({ page }) => {
  guard('MapDesktopAdd', 'wide');
  await openActions(page);
  await board(page, 'MapDesktopAdd');
});

test('MapDesktopFindForm', async ({ page }) => {
  guard('MapDesktopFindForm', 'wide');
  await openForm(page, 'Fund melden', 'Bestätigen');
  await setDate(page);
  await addPhoto(page);
  await board(page, 'MapDesktopFindForm');
});
