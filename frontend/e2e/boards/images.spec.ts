import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { flatMap } from '../fixtures/flat-map';
import { bundle } from '../fixtures/species';
import { join } from 'node:path';
import {
  CHANTERELLE_SPECIES,
  QUEUE_PHOTOS,
  SPECIES_PHOTOS,
  STONE_SPECIES,
  photoFixture,
  photoPage,
} from '../fixtures/photos';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** A board belongs to one device. It does not run while it is pending. */
function guard(board: string, device: 'phone' | 'desktop'): void {
  test.skip(test.info().project.name !== device, `Board gehört zu ${device}`);
  skipPending(board);
}

/** The administration gets its counts when it opens. Without a reply it shows an error. */
const SUMMARY = {
  texts: 0,
  photos: 0,
  photosPending: 0,
  species: 0,
  roles: 0,
  permissions: 0,
  people: 0,
  finds: 0,
  findsPending: 0,
  runs: 0,
  runsRunning: 0,
};

/** The same photos, with the second one as the lead photo. */
const LEAD_SECOND = SPECIES_PHOTOS.map((one, at) => ({ ...one, lead: at === 1 }));

/** The rights that the service gives to the signed-in person. */
function rights(permissions: readonly string[]): Record<string, unknown> {
  return { '/api/me/permissions': { permissions, roles: [] } };
}

/** Opens an address with the species catalogue and the photos. */
async function open(
  page: Page,
  path: string,
  extra: Record<string, unknown> = {},
  photo?: string,
): Promise<void> {
  await mockApi(
    page,
    {
      '/api/config': authConfig(BASE),
      '/api/species/bundle': bundle([STONE_SPECIES, CHANTERELLE_SPECIES]),
      ...extra,
    },
    photo === undefined ? {} : { photo },
  );
  await flatMap(page);
  await page.goto(path);
}

/** Picks the photo fixture of the board in the form and waits for the tile. */
async function pick(page: Page, photo: string): Promise<void> {
  const file = join(test.info().config.rootDir, 'boards/fixtures', photo);
  await page.locator('app-photo-strip input[type=file]').setInputFiles(file);
  await expect(page.locator('app-photo-strip .pht img')).toBeVisible();
}

test('ImageView', async ({ page }) => {
  guard('ImageView', 'phone');
  await open(
    page,
    '/arten/boletus-edulis/bilder/bild-zwei',
    { '/api/photos': photoPage(SPECIES_PHOTOS) },
    photoFixture(358, 300),
  );
  await expect(page.getByText('2 von 4')).toBeVisible();
  await expect(page.getByText('CC BY-SA 4.0', { exact: true })).toBeVisible();
  await expectBoard(page, 'ImageView');
});

test('ImageViewAdmin', async ({ page }) => {
  guard('ImageViewAdmin', 'phone');
  await mockSignIn(page);
  await open(
    page,
    '/arten/boletus-edulis/bilder/bild-zwei',
    { '/api/photos': photoPage(LEAD_SECOND), ...rights(['image.review']) },
    photoFixture(358, 300),
  );
  await expect(page.getByText('2 von 4')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Titelbild' })).toBeChecked();
  await expectBoard(page, 'ImageViewAdmin');
});

test('ImageAdd', async ({ page }) => {
  guard('ImageAdd', 'phone');
  await mockSignIn(page);
  await open(page, '/arten/boletus-edulis/bilder/neu', {
    '/api/photos': photoPage(SPECIES_PHOTOS),
    ...rights(['image.review']),
  });
  await expect(page.getByRole('heading', { name: 'Bild hinzufügen' })).toBeVisible();
  await pick(page, photoFixture(358, 160));
  await page.getByLabel('Urheber').fill('Frederik Beimgraben');
  await page.getByRole('button', { name: /Herkunft/ }).click();
  await page.getByRole('button', { name: 'CC BY-SA 4.0' }).click();
  await page.getByLabel('Aufgenommen').fill('2026-09-06');
  await page.getByRole('checkbox', { name: 'Als Titelbild der Art' }).check();
  await expectBoard(page, 'ImageAdd');
});

test('ImageSubmit', async ({ page }) => {
  guard('ImageSubmit', 'phone');
  await mockSignIn(page);
  await open(page, '/arten/boletus-edulis/bilder/neu', {
    '/api/photos': photoPage(SPECIES_PHOTOS),
    ...rights([]),
  });
  await expect(page.getByRole('heading', { name: 'Bild einreichen' })).toBeVisible();
  await pick(page, photoFixture(358, 160));
  await page.getByLabel('Urheber').fill('Frederik Beimgraben');
  await page.getByLabel('Aufgenommen').fill('2026-09-06');
  await expectBoard(page, 'ImageSubmit');
});

test('ImageUploading', async ({ page }) => {
  guard('ImageUploading', 'phone');
  await mockSignIn(page);
  await open(page, '/arten/boletus-edulis/bilder/neu', {
    '/api/photos': photoPage(SPECIES_PHOTOS),
    ...rights([]),
  });
  await pick(page, photoFixture(358, 200));
  await page.getByLabel('Urheber').fill('Frederik Beimgraben');
  await page.getByLabel('Aufgenommen').fill('2026-09-06');
  // The reply does not come, so the board shows the upload in progress.
  await page.route('**/api/photos', async (route) => {
    if (route.request().method() === 'POST') await new Promise(() => undefined);
    else await route.fallback();
  });
  await page.getByRole('button', { name: 'Einreichen', exact: true }).click();
  await expect(page.locator('app-progress')).toBeVisible();
  await expectBoard(page, 'ImageUploading', { idle: false });
});

test('ImageQueue', async ({ page }) => {
  guard('ImageQueue', 'phone');
  await mockSignIn(page);
  await open(
    page,
    '/verwaltung/bilder',
    { '/api/photos': photoPage(QUEUE_PHOTOS), '/api/admin/summary': SUMMARY, ...rights(['image.review']) },
    photoFixture(358, 330),
  );
  await expect(page.getByText('Junge Exemplare im Moos')).toBeVisible();
  await expectBoard(page, 'ImageQueue');
});

test('ImageReject', async ({ page }) => {
  guard('ImageReject', 'phone');
  await mockSignIn(page);
  await open(
    page,
    '/verwaltung/bilder',
    { '/api/photos': photoPage(QUEUE_PHOTOS), '/api/admin/summary': SUMMARY, ...rights(['image.review']) },
    photoFixture(358, 330),
  );
  await expect(page.getByText('Junge Exemplare im Moos')).toBeVisible();
  await page.getByRole('button', { name: 'Ablehnen' }).click();
  await page.getByRole('button', { name: 'Art nicht erkennbar' }).click();
  await expect(page.getByRole('dialog', { name: 'Warum lehnst du ab?' })).toBeVisible();
});
