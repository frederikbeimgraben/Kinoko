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

/** Die Karte um einen Punktbetrag ziehen, damit die Ecken auseinander liegen. */
async function pan(page: Page, dx: number, dy: number): Promise<void> {
  const from = { x: 195, y: 200 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
  // Ohne Ruhe vor dem Loslassen schwingt die Karte nach und trägt den Zug
  // weiter, als er ging.
  await page.waitForTimeout(250);
  await page.mouse.move(from.x + dx, from.y + dy);
  await page.mouse.up();
  await page.waitForTimeout(400);
}

/** Die vier Ecken des Bretts `ZoneDraw`, in Punkten des Fensters. */
const ZONE_CORNERS: readonly (readonly [number, number])[] = [
  [120, 382],
  [250, 332],
  [300, 422],
  [195, 340],
];

test('ZoneDraw', async ({ page }) => {
  guard('ZoneDraw', 'phone');
  await openActions(page, true);
  await page.getByRole('button', { name: 'Zone zeichnen' }).click();
  // Eine Ecke entsteht in der Mitte der Karte, nicht in der Mitte des Bildes.
  const canvas = await page.locator('.map__canvas').boundingBox();
  const middle = [(canvas?.x ?? 0) + (canvas?.width ?? 0) / 2, (canvas?.y ?? 0) + (canvas?.height ?? 0) / 2];
  // Jede Ecke entsteht unter dem Fadenkreuz. Der Zug danach schiebt sie an
  // ihren Platz und bringt die nächste unter das Kreuz.
  const offsets = ZONE_CORNERS.map(([x, y]) => [x - middle[0], y - middle[1]]);
  for (let corner = 0; corner < offsets.length; corner += 1) {
    await page.getByRole('button', { name: 'Eckpunkt setzen' }).click();
    const next = offsets[corner + 1] ?? [0, 0];
    await pan(page, offsets[corner][0] - next[0], offsets[corner][1] - next[1]);
  }
  await boardUnder(page, 'ZoneDraw');
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
