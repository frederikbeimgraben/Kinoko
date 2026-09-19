import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import LIVE_BUNDLE from '../fixtures/live-bundle.json' with { type: 'json' };

/** Der ETag, den ein älterer Stand auf dem Gerät mitbringt. */
const STALE_ETAG = 'W/"a1b2c3d4e5f60718"';

/** Ein Stand vom Gerät, der vor dem Feld `facets` abgelegt wurde. */
const STALE_BUNDLE = {
  items: LIVE_BUNDLE.items,
  standardColours: LIVE_BUNDLE.standardColours,
};

/** Die Bereiche des Speichers auf dem Gerät, wie `OfflineStore` sie anlegt. */
const AREAS = ['catalog', 'texts', 'permissions', 'objects', 'queue'];

/**
 * Legt einen Katalog auf dem Gerät ab, bevor die App startet.
 */
async function seedStore(page: Page, bundle: unknown, etag: string): Promise<void> {
  await page.addInitScript(
    ([areas, stored, tag]) => {
      const open = indexedDB.open('primordium', 1);
      open.onupgradeneeded = () => {
        for (const area of areas) open.result.createObjectStore(area);
      };
      open.onsuccess = () => {
        const deal = open.result.transaction('catalog', 'readwrite');
        deal.objectStore('catalog').put(stored, 'bundle');
        deal.objectStore('catalog').put(tag, 'etag');
      };
    },
    [AREAS, bundle, etag] as const,
  );
}

/**
 * Antwortet wie der Dienst: zum bekannten ETag kommt 304 ohne Körper.
 * Der ETag zählt nur die Arten, also bleibt er über einen Feldzuwachs gleich.
 */
async function serveBundle(page: Page, etag: string): Promise<void> {
  await page.route('**/api/species/bundle', async (route) => {
    if (route.request().headers()['if-none-match'] === etag) {
      await route.fulfill({ status: 304, headers: { ETag: etag } });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { ETag: etag },
      body: JSON.stringify(LIVE_BUNDLE),
    });
  });
}

/** Öffnet das Filterblatt und darin eine Gruppe. */
async function openGroup(page: Page, group: string): Promise<void> {
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await page.getByRole('button', { name: group }).first().click();
}

test('Die Gruppen des Filters füllen sich aus der Antwort des Dienstes', async ({ page }) => {
  await mockApi(page, { '/api/species/bundle': LIVE_BUNDLE });
  await page.goto('/arten');
  await expect(page.getByText('Steinpilz', { exact: true })).toBeVisible();

  await openGroup(page, 'Speisewert');

  await expect(page.getByRole('checkbox', { name: /essbar/ }).first()).toBeVisible();
});

test('Ein Stand ohne Achsen weicht dem frischen Katalog', async ({ page }) => {
  await seedStore(page, STALE_BUNDLE, STALE_ETAG);
  await mockApi(page);
  await serveBundle(page, STALE_ETAG);
  await page.goto('/arten');
  await expect(page.getByText('Steinpilz', { exact: true })).toBeVisible();

  await openGroup(page, 'Hutform');

  await expect(page.getByRole('checkbox', { name: /halbkugelig/ })).toBeVisible();
});
