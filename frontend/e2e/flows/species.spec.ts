import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { bundle, species } from '../fixtures/species';
import { TAXON } from '../fixtures/species-boards';

const PAGE = 40;

/** A catalogue that is longer than one page. */
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

  // The assertion waits for the request. Its position in the request order
  // changes under load.
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

  // The link carries the species: it stands first in the list of the genus.
  await expect(page).toHaveURL(/\/taxonomie\/genus\/boletus\?art=boletus-edulis$/);
  await expect(page.locator('app-section').last().locator('app-list-row').first()).toContainText('Steinpilz');
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page).toHaveURL(/\/arten\/boletus-edulis$/);
});
