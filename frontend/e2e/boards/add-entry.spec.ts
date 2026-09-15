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

async function openMap(page: Page): Promise<void> {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation(PLACE);
  await mockSignIn(page);
  await mockApi(page, { ...REPLIES, '/api/config': authConfig(BASE) }, { photo: ROW_PHOTO });
  await mockMap(page, { detent: 1 });
  await page.goto('/karte');
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
  // Die Boards nennen den Ort unter dem Fadenkreuz; die Karte steht dort.
  await page.getByRole('button', { name: 'Standort' }).click();
  await page.waitForTimeout(800);
}

/** Öffnet das Blatt hinter dem Plus-Knopf. */
async function openActions(page: Page): Promise<void> {
  await openMap(page);
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
