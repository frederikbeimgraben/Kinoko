import { expect, test, type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { flatMap } from '../fixtures/flat-map';
import { bundle, SEVEN } from '../fixtures/species';
import { lookalikesBundle, profileBundle, profileManifest, profilePhotos } from '../fixtures/species-page';
import { expectBoard, skipPending } from './board';

/** Die Fotos der Artseite: das Titelbild gross, die Kacheln in Listengrösse. */
const ROWS = {
  'la-1/list': 'photo-44x44.png',
  'la-2/list': 'photo-44x44.png',
  'la-3/list': 'photo-44x44.png',
};
const PHOTOS = { full: 'photo-358x210.png', list: 'photo-88x88.png', ...ROWS };
const PHOTOS_WIDE = { full: 'photo-548x240.png', list: 'photo-88x88.png', ...ROWS };

/** Ein Board gehört zu einem Gerät und läuft nicht, solange es aussteht. */
function guard(board: string, device: 'phone' | 'desktop'): void {
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

/** Rollt die Seite, bis die Überschrift des Abschnitts fast am oberen Rand steht. */
async function scrollToSection(page: Page, heading: string): Promise<void> {
  await page.evaluate((title) => {
    const view = document.querySelector('.page');
    const node = Array.from(view?.querySelectorAll('h2') ?? []).find(
      (one) => one.textContent.trim() === title,
    );
    if (view === null || !node) return;
    const top = node.getBoundingClientRect().top - view.getBoundingClientRect().top + view.scrollTop;
    view.scrollTop = Math.max(top - 28, 0);
  }, heading);
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
  await scrollToSection(page, 'Maße');
  await expectBoard(page, 'SpeciesSize');
});

test('SpeciesColours', async ({ page }) => {
  guard('SpeciesColours', 'phone');
  await openProfile(page);
  await scrollToSection(page, 'Farben');
  await expectBoard(page, 'SpeciesColours');
});

test('SpeciesColourChange', async ({ page }) => {
  guard('SpeciesColourChange', 'phone');
  await openProfile(page);
  await scrollToSection(page, 'Verfärbung');
  await expectBoard(page, 'SpeciesColourChange');
});

test('SpeciesSeason', async ({ page }) => {
  guard('SpeciesSeason', 'phone');
  await openProfile(page);
  await scrollToSection(page, 'Zeitraum');
  await expectBoard(page, 'SpeciesSeason');
});

test('SpeciesSenses', async ({ page }) => {
  guard('SpeciesSenses', 'phone');
  await openProfile(page);
  await scrollToSection(page, 'Geruch und Geschmack');
  await expectBoard(page, 'SpeciesSenses');
});

test('SpeciesHymenium', async ({ page }) => {
  guard('SpeciesHymenium', 'phone');
  await openProfile(page);
  await scrollToSection(page, 'Fruchtschicht');
  await expectBoard(page, 'SpeciesHymenium');
});

test('CompareEntry', async ({ page }) => {
  guard('CompareEntry', 'phone');
  await mockApi(
    page,
    { '/api/species/bundle': lookalikesBundle(), '/api/photos': { items: [], nextCursor: null } },
    { photo: ROWS },
  );
  await flatMap(page);
  await page.goto('/arten/boletus-edulis');
  await expect(page.getByText('Gallenröhrling')).toBeVisible();
  await scrollToSection(page, 'Verwechslungen');
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
  guard('SpeciesPageDesktop', 'desktop');
  await openProfile(page, PHOTOS_WIDE);
  await expectBoard(page, 'SpeciesPageDesktop');
});
