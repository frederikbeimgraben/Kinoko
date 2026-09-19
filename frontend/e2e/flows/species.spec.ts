import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { bundle, species } from '../fixtures/species';
import { TAXON } from '../fixtures/species-boards';

const PAGE = 40;

/** Ein Katalog, der über eine Seite hinausreicht. */
function manySpecies(count: number): Record<string, unknown> {
  return {
    items: Array.from({ length: count }, (_, at) =>
      species(
        {
          slug: `art-${String(at)}`,
          name: `Art ${String(at)}`,
          latin: `Genus specimen${String(at)}`,
          edibility: 'edible',
        },
        at,
      ),
    ),
  };
}

const SEARCHABLE = bundle([
  { slug: 'boletus-edulis', name: 'Steinpilz', latin: 'Boletus edulis', edibility: 'edible' },
  { slug: 'imleria-badia', name: 'Maronenröhrling', latin: 'Imleria badia', edibility: 'edible' },
  { slug: 'amanita-rubescens', name: 'Perlpilz', latin: 'Amanita rubescens', edibility: 'edible' },
]);

async function openList(page: Page, items: unknown): Promise<void> {
  await mockApi(page, { '/api/species/bundle': items });
  await page.goto('/arten');
}

test('Suche nach Name und nach dem lateinischen Namen', async ({ page }) => {
  await openList(page, SEARCHABLE);
  await expect(page.getByText('Perlpilz')).toBeVisible();

  await page.getByRole('textbox').fill('stein');
  await expect(page.getByText('Steinpilz')).toBeVisible();
  await expect(page.getByText('Perlpilz')).toHaveCount(0);

  await page.getByRole('textbox').fill('amanita');
  await expect(page.getByText('Perlpilz')).toBeVisible();
  await expect(page.getByText('Steinpilz')).toHaveCount(0);
});

test('Die zweite Seite lädt beim Scrollen', async ({ page }) => {
  await openList(page, manySpecies(PAGE + 5));
  await expect(page.getByRole('button', { name: /Art 0 / })).toBeVisible();
  await expect(page.getByRole('button', { name: /Art 40 / })).toHaveCount(0);

  await page.getByRole('button', { name: /Art 39 / }).scrollIntoViewIfNeeded();

  await expect(page.getByRole('button', { name: /Art 44 / })).toBeVisible();
});

test.describe('Suchfeld am Telefon', () => {
  test.use({ hasTouch: true });

  test('Tipp auf das Suchfeld fokussiert es und filtert nach Eingabe', async ({ page }) => {
    await openList(page, SEARCHABLE);
    await expect(page.getByText('Perlpilz')).toBeVisible();

    await page.locator('.search').tap();
    await expect(page.getByRole('textbox')).toBeFocused();

    await page.keyboard.type('stein');
    await expect(page.getByText('Steinpilz')).toBeVisible();
    await expect(page.getByText('Perlpilz')).toHaveCount(0);
  });
});

test('Die Einordnung holt die Stufe aus dem Vertrag', async ({ page }) => {
  await mockApi(page, {
    '/api/species/bundle': bundle(TAXON.catalogue),
    '/api/taxa/family/boletaceae': TAXON.page,
    '/api/taxa/genus/boletus': { ...TAXON.page, slug: 'boletus', name: 'Boletus', rank: 'genus' },
  });
  await page.goto('/taxonomie/family/boletaceae');
  await expect(page.getByText('Rotfußröhrling')).toBeVisible();

  // Die Zusicherung wartet auf die Anfrage. Ihre Stelle in der Reihe der
  // Anfragen schwankt unter Last.
  const call = page.waitForRequest('**/api/taxa/genus/boletus');
  await page.getByRole('button', { name: 'Boletus 3 Arten' }).click();

  await expect(page).toHaveURL(/\/taxonomie\/genus\/boletus$/);
  await call;
});

test('Die Artseite führt über die Einordnung zur Gattung', async ({ page }) => {
  await mockApi(page, {
    '/api/species/bundle': bundle(TAXON.catalogue),
    '/api/taxa/genus/boletus': { ...TAXON.page, slug: 'boletus', name: 'Boletus', rank: 'genus' },
  });
  await page.goto('/arten/boletus-edulis');

  await page.getByRole('button', { name: /Einordnung/ }).click();

  await expect(page).toHaveURL(/\/taxonomie\/genus\/boletus$/);
});
