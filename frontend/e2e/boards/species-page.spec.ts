import { expect, test, type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { flatMap } from '../fixtures/flat-map';
import { bundle, SEVEN } from '../fixtures/species';
import { profileBundle } from '../fixtures/species-page';
import { expectBoard, skipPending } from './board';

/** Ein Board gehört zu einem Gerät und läuft nicht, solange es aussteht. */
function guard(board: string, device: 'phone' | 'desktop'): void {
  test.skip(test.info().project.name !== device, `Board gehört zu ${device}`);
  skipPending(board);
}

/** Öffnet die Artseite mit dem vollen Profil aus den Boards. */
async function openProfile(page: Page, slug = 'boletus-edulis'): Promise<void> {
  await mockApi(page, { '/api/species/bundle': profileBundle() });
  await flatMap(page);
  await page.goto(`/arten/${slug}`);
}

test('SpeciesPage', async ({ page }) => {
  guard('SpeciesPage', 'phone');
  await openProfile(page);
  await expect(page.getByRole('heading', { name: 'Steinpilz' })).toBeVisible();
  await expectBoard(page, 'SpeciesPage');
});

test('SpeciesFeatures', async ({ page }) => {
  guard('SpeciesFeatures', 'phone');
  await openProfile(page);
  await expect(page.getByText('essbar')).toBeVisible();
  await expectBoard(page, 'SpeciesFeatures');
});

test('CompareEntry', async ({ page }) => {
  guard('CompareEntry', 'phone');
  await openProfile(page);
  await expect(page.getByText('Gallenröhrling')).toBeVisible();
  await page.getByText('Gallenröhrling').scrollIntoViewIfNeeded();
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
  await openProfile(page);
  await expect(page.getByRole('heading', { name: 'Steinpilz' })).toBeVisible();
  await expectBoard(page, 'SpeciesPageDesktop');
});
