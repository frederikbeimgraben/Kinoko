import { type Page } from '@playwright/test';
import { expect, test } from '../fixtures/test';
import { mockApi } from '../fixtures/api';
import { EVERY_RIGHT } from '../fixtures/admin';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { flatMap } from '../fixtures/flat-map';
import { PALETTE } from '../fixtures/species';
import { STONE_PROFILE } from '../fixtures/species-page';
import { STONE_SECTIONS } from '../fixtures/species-sections';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** A species with a pendant ring of 5 to 10 mm. */
const RINGED: Record<string, unknown> = {
  ...STONE_PROFILE,
  ringShape: 'pendant',
  measurements: [
    ...(STONE_PROFILE['measurements'] as unknown[]),
    { part: 'ring', measurements: [{ dimension: 'width', unit: 'mm', low: 5, high: 10 }] },
  ],
};

/** Opens the page of a part in the species editor. The species has a pendant ring. */
async function openPartEditor(page: Page, part: string, heading: string): Promise<void> {
  await mockSignIn(page);
  await mockApi(page, {
    '/api/config': authConfig(BASE),
    '/api/me/permissions': { permissions: EVERY_RIGHT, roles: [] },
    '/api/species/boletus-edulis': { ...STONE_SECTIONS, ringShape: 'pendant' },
    '/api/species/boletus-edulis/counts': { records: 1, finds: 0, photos: 0 },
  });
  await page.goto(`/verwaltung/arten/boletus-edulis/teil/${part}`);
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
}

test('Die Artseite zeigt die Form in der Karte des Rings', async ({ page }) => {
  await mockApi(page, { '/api/species/bundle': { items: [RINGED], standardColours: PALETTE, facets: {} } });
  await flatMap(page);
  await page.goto('/arten/boletus-edulis');

  const ring = page.locator('app-measurement-group').filter({ hasText: 'Ring' });
  await expect(ring.locator('.group__fact')).toHaveText(/Form\s*hängend/);
  await expect(ring.locator('app-measurement')).toHaveCount(1);
});

test('Der Teil-Editor des Rings schreibt die gewählte Form', async ({ page }) => {
  await openPartEditor(page, 'ring', 'Ring');
  const writes: unknown[] = [];
  await page.route('**/api/species/boletus-edulis', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.fallback();
      return;
    }
    writes.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...STONE_SECTIONS, ringShape: 'double' }),
    });
  });

  const shapes = page.getByRole('group', { name: 'Form' });
  await expect(shapes.getByRole('button', { name: 'hängend' })).toHaveAttribute('aria-pressed', 'true');
  await shapes.getByRole('button', { name: 'doppelt' }).click();
  await page.getByRole('button', { name: 'Übernehmen' }).click();

  await expect
    .poll(() => writes.map((body) => (body as { ringShape: unknown }).ringShape))
    .toEqual(['double']);
});

test('Der Teil-Editor des Huts zeigt keine Form', async ({ page }) => {
  await openPartEditor(page, 'cap', 'Hut');

  await expect(page.getByRole('group', { name: 'Form' })).toHaveCount(0);
});
