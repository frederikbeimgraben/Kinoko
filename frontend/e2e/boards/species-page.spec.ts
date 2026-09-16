import { expect, test, type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { flatMap } from '../fixtures/flat-map';
import { bundle, SEVEN } from '../fixtures/species';
import { profileBundle, profileManifest, profilePhotos } from '../fixtures/species-page';
import { expectBoard, skipPending } from './board';

/** Die Fotos der Artseite: das Titelbild gross, die Kacheln in Listengrösse. */
const ROWS = {
  'la-1/list': 'photo-44x44.png',
  'la-2/list': 'photo-44x44.png',
  'la-3/list': 'photo-44x44.png',
};
const PHOTOS = { full: 'photo-358x269.png', list: 'photo-88x88.png', ...ROWS };
const PHOTOS_WIDE = { full: 'photo-866x650.png', list: 'photo-88x88.png', ...ROWS };

/** Ein Board gehört zu einem Gerät und läuft nicht, solange es aussteht. */
function guard(board: string, device: 'phone' | 'wide'): void {
  test.skip(test.info().project.name !== device, `Board gehört zu ${device}`);
  skipPending(board);
}

/** Öffnet die Artseite mit dem vollen Profil, den Bildern und der Karte. */
async function openProfile(page: Page, photos = PHOTOS): Promise<void> {
  await mockApi(
    page,
    { '/api/species/bundle': profileBundle(), '/api/photos': profilePhotos() },
    { photo: photos },
  );
  await flatMap(page);
  await page.route('**/boletus-edulis.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(profileManifest()),
    });
  });
  await page.goto('/arten/boletus-edulis');
  await expect(page.getByRole('heading', { name: 'Steinpilz' })).toBeVisible();
  await expect(page.locator('app-species-season app-season-curve')).toBeVisible();
}

/** Die Rollhöhe je Abschnitts-Brett, aus dem Bild des Bretts gemessen. */
const SECTION_TOP: Record<string, number> = {
  SpeciesSize: 471,
  SpeciesColours: 991,
  SpeciesColourChange: 1266,
  SpeciesSeason: 1718,
  SpeciesSenses: 1854,
  SpeciesHymenium: 2149,
  CompareEntry: 2304,
};

/** Rollt die Seite auf die Höhe, die das Brett zeigt. */
async function scrollToSection(page: Page, board: string): Promise<void> {
  await page.evaluate((top) => {
    const view = document.querySelector('.page');
    if (view !== null) view.scrollTop = top;
  }, SECTION_TOP[board] ?? 0);
}

test('SpeciesPage', async ({ page }) => {
  guard('SpeciesPage', 'phone');
  await openProfile(page);
  await expectBoard(page, 'SpeciesPage');
});

test('SpeciesFeatures', async ({ page }) => {
  guard('SpeciesFeatures', 'phone');
  await openProfile(page);
  await expectBoard(page, 'SpeciesFeatures');
});

test('SpeciesImages', async ({ page }) => {
  guard('SpeciesImages', 'phone');
  await openProfile(page);
  await expectBoard(page, 'SpeciesImages');
});

test('SpeciesSize', async ({ page }) => {
  guard('SpeciesSize', 'phone');
  await openProfile(page);
  await scrollToSection(page, 'SpeciesSize');
  await expectBoard(page, 'SpeciesSize');
});

test('SpeciesColours', async ({ page }) => {
  guard('SpeciesColours', 'phone');
  await openProfile(page);
  await scrollToSection(page, 'SpeciesColours');
  await expectBoard(page, 'SpeciesColours');
});

test('SpeciesColourChange', async ({ page }) => {
  guard('SpeciesColourChange', 'phone');
  await openProfile(page);
  await scrollToSection(page, 'SpeciesColourChange');
  await expectBoard(page, 'SpeciesColourChange');
});

test('SpeciesSeason', async ({ page }) => {
  guard('SpeciesSeason', 'phone');
  await openProfile(page);
  await scrollToSection(page, 'SpeciesSeason');
  await expectBoard(page, 'SpeciesSeason');
});

test('SpeciesSenses', async ({ page }) => {
  guard('SpeciesSenses', 'phone');
  await openProfile(page);
  await scrollToSection(page, 'SpeciesSenses');
  await expectBoard(page, 'SpeciesSenses');
});

test('SpeciesHymenium', async ({ page }) => {
  guard('SpeciesHymenium', 'phone');
  await openProfile(page);
  await scrollToSection(page, 'SpeciesHymenium');
  await expectBoard(page, 'SpeciesHymenium');
});

test('CompareEntry', async ({ page }) => {
  guard('CompareEntry', 'phone');
  await openProfile(page);
  await scrollToSection(page, 'CompareEntry');
  await expectBoard(page, 'CompareEntry');
});

test('SpeciesNotFound', async ({ page }) => {
  guard('SpeciesNotFound', 'phone');
  await mockApi(page, { '/api/species/bundle': bundle(SEVEN) });
  await flatMap(page);
  await page.goto('/arten/gibt-es-nicht');
  await expect(page.getByText('Art nicht gefunden')).toBeVisible();
  await expectBoard(page, 'SpeciesNotFound');
});

test('SpeciesPageDesktop', async ({ page }) => {
  guard('SpeciesPageDesktop', 'wide');
  await openProfile(page, PHOTOS_WIDE);
  await expectBoard(page, 'SpeciesPageDesktop');
});
