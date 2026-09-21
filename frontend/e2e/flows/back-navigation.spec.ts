import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { flatMap } from '../fixtures/flat-map';
import { COMBINATIONS, SPECIES_BUNDLE, mockMap } from '../fixtures/map';
import { SPECIES_PHOTOS, STONE_SPECIES, photoPage } from '../fixtures/photos';
import { bundle } from '../fixtures/species';
import { largeBundle } from '../fixtures/species-catalogue';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** Öffnet die Artseite des Steinpilzes über die Liste, angemeldet. */
async function openSpecies(page: Page): Promise<void> {
  await mockSignIn(page);
  await mockApi(page, {
    '/api/config': authConfig(BASE),
    '/api/species/bundle': bundle([STONE_SPECIES]),
    '/api/photos': photoPage(SPECIES_PHOTOS),
  });
  await flatMap(page);
  await page.goto('/arten');
  await page.getByRole('button', { name: /Steinpilz/ }).click();
  await expect(page).toHaveURL(/\/arten\/boletus-edulis$/);
}

/** Öffnet die Karte mit Arten und Kombinationen aus dem Gerät. */
async function openMap(page: Page): Promise<void> {
  await mockApi(page, {
    '/api/species/bundle': SPECIES_BUNDLE,
    '/api/combinations': COMBINATIONS,
    '/api/funde': { eintraege: [], gesamt: 0 },
    '/api/finds': { items: [], nextCursor: null },
    '/api/marker': { eintraege: [], gesamt: 0 },
    '/api/zonen': { eintraege: [], gesamt: 0 },
  });
  await mockMap(page);
  await page.goto('/karte');
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
}

test.describe('Zurück in der Artenliste', () => {
  test.use({ hasTouch: true });

  test('Tipp auf Schließen schließt das Filterblatt', async ({ page }) => {
    await mockApi(page, { '/api/species/bundle': largeBundle() });
    await page.goto('/arten');
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Speisewert' })).toBeVisible();

    await page.getByRole('dialog').getByRole('button', { name: 'Schließen' }).click();

    await expect(page.getByRole('button', { name: 'Filter', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Die Browser-Geste zurück schließt das Filterblatt', async ({ page }) => {
    await mockApi(page, { '/api/species/bundle': largeBundle() });
    await page.goto('/arten');
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Speisewert' })).toBeVisible();

    await page.goBack();

    await expect(page.getByRole('button', { name: 'Filter', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test('Die Browser-Geste zurück schließt ein Blatt über der Karte', async ({ page }) => {
  await openMap(page);
  await page.getByRole('button', { name: 'Steinpilz' }).click();
  await expect(page.getByText('Art wählen')).toBeVisible();

  await page.goBack();
  await expect(page.getByText('Art wählen')).toHaveCount(0);
});

test.describe('Zurück von einer Bildseite', () => {
  test('Der Pfeil führt vom Formular einmal auf die Artseite', async ({ page }) => {
    await openSpecies(page);
    await page.getByRole('button', { name: 'Mehr' }).click();
    await page.getByRole('button', { name: 'Bild einreichen' }).click();
    await expect(page).toHaveURL(/bilder\/neu$/);

    await page.getByRole('button', { name: 'Zurück' }).click();
    await expect(page).toHaveURL(/\/arten\/boletus-edulis$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/arten$/);
  });

  test('Die Browser-Geste führt vom Formular einmal auf die Artseite', async ({ page }) => {
    await openSpecies(page);
    await page.getByRole('button', { name: 'Mehr' }).click();
    await page.getByRole('button', { name: 'Bild einreichen' }).click();
    await expect(page).toHaveURL(/bilder\/neu$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/arten\/boletus-edulis$/);
  });

  test('Der Pfeil führt vom Bild einmal auf die Artseite', async ({ page }) => {
    await openSpecies(page);
    await page.locator('.photos__tile').first().click();
    await expect(page).toHaveURL(/bilder\/bild-eins$/);

    await page.getByRole('button', { name: 'Zurück' }).click();
    await expect(page).toHaveURL(/\/arten\/boletus-edulis$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/arten$/);
  });
});
