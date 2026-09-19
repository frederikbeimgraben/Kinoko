import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { mockApi } from '../fixtures/api';
import { ROW_PHOTO } from '../fixtures/photos';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { MARKERS, SHARED_FINDS, SPECIES_BUNDLE, ZONES, mockMap, showMapImage } from '../fixtures/map';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** Die Karte des Boards läuft unter dem Blatt weiter. */
const MAP_HEIGHT = 844;

/** Der Tag und der Ort, die in den Boards stehen. */
const FOUND_ON = '2026-09-09';
const PLACE = { latitude: 48.5203, longitude: 9.0511 };

/** Ein Board gehört zu einem Gerät und läuft nicht, solange es aussteht. */
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
};

async function openMap(page: Page, clear = false): Promise<void> {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation(PLACE);
  await mockSignIn(page);
  await mockApi(page, { ...REPLIES, '/api/config': authConfig(BASE) }, { photo: ROW_PHOTO });
  await mockMap(page, { detent: 1, clear });
  await page.goto('/karte');
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
  // Die Boards nennen den Ort unter dem Fadenkreuz; die Karte steht dort.
  await page.getByRole('button', { name: 'Standort' }).click();
  await page.waitForTimeout(800);
}

/** Öffnet das Blatt hinter dem Plus-Knopf. */
async function openActions(page: Page, clear = false): Promise<void> {
  await openMap(page, clear);
  await page.getByRole('button', { name: 'Eintragen' }).click();
  await expect(page.getByRole('button', { name: 'Fund melden' })).toBeVisible();
}

/** Geht über das Fadenkreuz in ein Formular. */
async function openForm(page: Page, action: string, confirm: string): Promise<void> {
  await openActions(page);
  await page.getByRole('button', { name: action }).click();
  await page.getByRole('button', { name: confirm }).click();
}

/** Legt das Kartenbild auf und vergleicht dann mit dem Board. */
async function board(page: Page, stem: string, image = 'map-stein-844.png'): Promise<void> {
  await showMapImage(page, image, image === 'map-desktop-stein-900.png' ? undefined : MAP_HEIGHT);
  await expectBoard(page, stem);
}

/** Wie `board`, aber das Kartenbild liegt unter der Zeichnung der Karte. */
async function boardUnder(page: Page, stem: string): Promise<void> {
  await showMapImage(page, 'map-stein-844.png', MAP_HEIGHT, true);
  await expectBoard(page, stem);
}

/** Dasselbe am Rechner: Marke und Ring der App liegen über dem Kartenbild. */
async function boardUnderWide(page: Page, stem: string): Promise<void> {
  await showMapImage(page, 'map-desktop-stein-900.png', undefined, true);
  await expectBoard(page, stem);
}

test('AddActions', async ({ page }) => {
  guard('AddActions', 'phone');
  await openActions(page);
  await board(page, 'AddActions');
});

/** Setzt den Tag, den die Fund-Boards zeigen. */
async function setDate(page: Page): Promise<void> {
  await page.locator('input[type="date"]').fill(FOUND_ON);
}

/** Legt das Foto ab, das die Boards in der ersten Kachel zeigen. */
async function addPhoto(page: Page): Promise<void> {
  const file = join(test.info().config.rootDir, 'boards/fixtures/tile-1-72x72.png');
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.locator('app-photo-picker img')).toBeVisible();
}

test('FindForm', async ({ page }) => {
  guard('FindForm', 'phone');
  await openForm(page, 'Fund melden', 'Fundort übernehmen');
  await expect(page.getByRole('heading', { name: 'Fund melden' })).toBeVisible();
  await setDate(page);
  await addPhoto(page);
  await board(page, 'FindForm');
});

test('FindSaving', async ({ page }) => {
  guard('FindSaving', 'phone');
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await openForm(page, 'Fund melden', 'Fundort übernehmen');
  await expect(page.getByRole('heading', { name: 'Fund melden' })).toBeVisible();
  await setDate(page);
  await addPhoto(page);
  // Das Datum des Bretts liegt nach der festen Uhr; sie rückt vor, damit
  // die Prüfung beim Speichern durchgeht.
  await page.clock.setFixedTime(new Date(`${FOUND_ON}T12:00:00Z`));
  // Hält die Antwort an, bis das Bild des beschäftigten Zustands steht.
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
  // Der Auftrag läuft: der Knopf verliert seine Beschriftung an den Spinner.
  await expect(page.locator('.btn--primary[aria-busy="true"]')).toBeVisible();
  await showMapImage(page, 'map-stein-844.png', MAP_HEIGHT);
  await expectBoard(page, 'FindSaving', { idle: false });
  release();
});

test('MarkerForm', async ({ page }) => {
  guard('MarkerForm', 'phone');
  await openForm(page, 'Marker setzen', 'Übernehmen');
  await expect(page.getByRole('heading', { name: 'Marker setzen' })).toBeVisible();
  // Das Board zeigt die dritte Farbe gewählt.
  await page.getByRole('radio').nth(2).click();
  await board(page, 'MarkerForm');
});

test('ZoneForm', async ({ page }) => {
  guard('ZoneForm', 'phone');
  await openActions(page);
  await page.getByRole('button', { name: 'Zone zeichnen' }).click();
  for (let corner = 0; corner < 3; corner += 1) {
    await page.getByRole('button', { name: 'Eckpunkt setzen' }).click();
  }
  await page.getByRole('button', { name: 'Zone abschließen' }).click();
  await expect(page.getByRole('heading', { name: 'Zone speichern' })).toBeVisible();
  await board(page, 'ZoneForm');
});

test('FindLocation', async ({ page }) => {
  guard('FindLocation', 'phone');
  await openActions(page);
  await page.getByRole('button', { name: 'Fund melden' }).click();
  await expect(page.getByRole('heading', { name: 'Fundort festlegen' })).toBeVisible();
  await board(page, 'FindLocation');
});

/** Der Haken der App, über den der Test die Karte genau setzt. */
interface MapHandle {
  aimAt(x: number, y: number): [number, number];
  showAt(lon: number, lat: number, x: number, y: number, zoom?: number): void;
}

/** Der Ort, der gerade unter einem Punkt des Fensters liegt. */
async function aimAt(page: Page, spot: readonly [number, number]): Promise<[number, number]> {
  return page.evaluate(([x, y]) => (window as unknown as { pilzMap: MapHandle }).pilzMap.aimAt(x, y), spot);
}

/** Schiebt die Karte, bis der Ort unter dem Punkt des Fensters liegt. */
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

/** Der Maßstab, auf dem die Karte im Brett `ZoneDraw` steht. */
const ZONE_ZOOM = 14;

/** Die vier Ecken des Bretts `ZoneDraw`, in Punkten des Fensters. */
const ZONE_CORNERS: readonly (readonly [number, number])[] = [
  [120, 363],
  [250, 313],
  [300, 403],
  [195, 321],
];

/** Die Karte des Bretts trägt keine eigenen Objekte und keinen Standort. */
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

test('ZoneDraw', async ({ page }) => {
  guard('ZoneDraw', 'phone');
  await openEmptyMap(page);
  await page.getByRole('button', { name: 'Zone zeichnen' }).click();
  // Das Blatt ändert das Polster der Karte; sie rückt danach noch nach.
  await page.waitForTimeout(600);
  const cross = await page.locator('app-crosshair').boundingBox();
  const middle: [number, number] = [
    (cross?.x ?? 0) + (cross?.width ?? 0) / 2,
    (cross?.y ?? 0) + (cross?.height ?? 0) / 2,
  ];
  // Erst die Orte merken, die im Bild des Bretts unter den Ecken liegen. Dann
  // jeden davon unter das Fadenkreuz holen und die Ecke setzen.
  // Der Maßstab des Bretts: die Fläche des Rings misst darin zweiundvierzig Hektar.
  await showAt(page, await aimAt(page, middle), middle, ZONE_ZOOM);
  const places: [number, number][] = [];
  for (const spot of ZONE_CORNERS) places.push(await aimAt(page, spot));
  for (const place of places) {
    await showAt(page, place, middle);
    await page.getByRole('button', { name: 'Eckpunkt setzen' }).click();
  }
  // Zum Schluss steht die Karte wieder so, wie das Brett sie zeigt.
  await showAt(page, places[0], ZONE_CORNERS[0]);
  await boardUnder(page, 'ZoneDraw');
});

/** Der Maßstab des Rechner-Bretts: sein Ring misst ebenfalls 42 Hektar. */
const ZONE_ZOOM_WIDE = 16.14;

/** Der linke Rand der Kartenfläche am Rechner: Schiene plus Spalte. */
const MAP_LEFT = 488;

/** Die Ecken und der Zeiger des Bretts `MapDesktopZoneDraw`, im Fenster. */
const WIDE_CORNERS: readonly (readonly [number, number])[] = [
  [MAP_LEFT + 450, 550],
  [MAP_LEFT + 450, 400],
  [MAP_LEFT + 650, 380],
  [MAP_LEFT + 680, 560],
];
const WIDE_POINTER: readonly [number, number] = [MAP_LEFT + 560, 650];

/** Der gesetzte Ort der Bretter `MapDesktopFindLocation` und `MapDesktopMarkerLocation`. */
const WIDE_MARK: readonly [number, number] = [MAP_LEFT + 488, 428];

/** Öffnet einen Schritt am Rechner. */
async function openStep(page: Page, action: string): Promise<void> {
  await openEmptyMap(page);
  await page.getByRole('button', { name: action }).click();
}

/** Setzt den Ort des Bretts unter den Zeiger und klickt ihn. */
async function markAt(page: Page): Promise<void> {
  await showAt(page, [PLACE.longitude, PLACE.latitude], WIDE_MARK, ZONE_ZOOM);
  await page.mouse.click(WIDE_MARK[0], WIDE_MARK[1]);
  await expect(page.getByText('48,5203 · 9,0511')).toBeVisible();
}

test('MapDesktopFindLocation', async ({ page }) => {
  guard('MapDesktopFindLocation', 'wide');
  await openStep(page, 'Fund melden');
  await markAt(page);
  await boardUnderWide(page, 'MapDesktopFindLocation');
});

test('MapDesktopMarkerLocation', async ({ page }) => {
  guard('MapDesktopMarkerLocation', 'wide');
  await openStep(page, 'Marker setzen');
  await markAt(page);
  await boardUnderWide(page, 'MapDesktopMarkerLocation');
});

test('MapDesktopZoneDraw', async ({ page }) => {
  guard('MapDesktopZoneDraw', 'wide');
  await openStep(page, 'Zone zeichnen');
  await showAt(page, await aimAt(page, WIDE_CORNERS[0]), WIDE_CORNERS[0], ZONE_ZOOM_WIDE);
  for (const corner of WIDE_CORNERS) await page.mouse.click(corner[0], corner[1]);
  await page.mouse.move(WIDE_POINTER[0], WIDE_POINTER[1]);
  await expect(page.getByText(/4 Eckpunkte/)).toBeVisible();
  await boardUnderWide(page, 'MapDesktopZoneDraw');
});

test('MapDesktopAdd', async ({ page }) => {
  guard('MapDesktopAdd', 'wide');
  await openActions(page);
  await board(page, 'MapDesktopAdd', 'map-desktop-stein-900.png');
});

test('MapDesktopFindForm', async ({ page }) => {
  guard('MapDesktopFindForm', 'wide');
  await openForm(page, 'Fund melden', 'Fundort übernehmen');
  await setDate(page);
  await addPhoto(page);
  await board(page, 'MapDesktopFindForm', 'map-desktop-stein-900.png');
});
