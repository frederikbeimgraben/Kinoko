import { expect, test, type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { COMBINATIONS, SPECIES_BUNDLE, mockMap } from '../fixtures/map';
import { bundle } from '../fixtures/species';
import { largeBundle } from '../fixtures/species-catalogue';

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

  test('Tipp auf den Pfeil verlässt die Gruppe', async ({ page }) => {
    await mockApi(page, { '/api/species/bundle': largeBundle() });
    await page.goto('/arten');
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    await page.getByRole('button', { name: 'Speisewert' }).first().click();
    await expect(page.getByRole('checkbox', { name: /essbar/ }).first()).toBeVisible();

    await page.locator('.filtersheet__back').tap();

    await expect(page.getByRole('button', { name: 'Speisewert' })).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(0);
  });

  test('Die Browser-Geste zurück verlässt die Gruppe, dann schließt das Blatt', async ({ page }) => {
    await mockApi(page, { '/api/species/bundle': largeBundle() });
    await page.goto('/arten');
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    await page.getByRole('button', { name: 'Speisewert' }).first().click();
    await expect(page.getByRole('checkbox', { name: /essbar/ }).first()).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('button', { name: 'Speisewert' })).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(0);

    await page.goBack();
    await expect(page.getByRole('button', { name: 'Filter', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Speisewert' })).toHaveCount(0);
  });
});

test('Am Rechner führt der Pfeil aus der Gruppe zur Übersicht zurück', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await mockApi(page, { '/api/species/bundle': bundle([]) });
  await page.goto('/arten');
  await page.getByRole('button', { name: 'Speisewert' }).click();
  await expect(page.getByRole('heading', { name: 'Speisewert' })).toBeVisible();

  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Speisewert' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Speisewert' })).toHaveCount(0);
});

test('Am Rechner schließt die Browser-Geste die Gruppe', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await mockApi(page, { '/api/species/bundle': bundle([]) });
  await page.goto('/arten');
  await page.getByRole('button', { name: 'Speisewert' }).click();
  await expect(page.getByRole('heading', { name: 'Speisewert' })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('button', { name: 'Speisewert' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Speisewert' })).toHaveCount(0);
});

test('Die Browser-Geste zurück schließt ein Blatt über der Karte', async ({ page }) => {
  await openMap(page);
  await page.getByRole('button', { name: 'Steinpilz' }).click();
  await expect(page.getByText('Art wählen')).toBeVisible();

  await page.goBack();
  await expect(page.getByText('Art wählen')).toHaveCount(0);
});
