import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import LIVE_BUNDLE from '../fixtures/live-bundle.json' with { type: 'json' };
import { DB_VERSION, OFFLINE_AREAS } from '../../src/app/core/offline/offline-store';

/** The ETag of an old catalogue version on the device. */
const STALE_ETAG = 'W/"a1b2c3d4e5f60718"';

/** A device version that the app stored before the field `facets` existed. */
const STALE_BUNDLE = {
  items: LIVE_BUNDLE.items,
  standardColours: LIVE_BUNDLE.standardColours,
};

/** Stores a catalogue on the device before the app starts. */
async function seedStore(page: Page, bundle: unknown, etag: string): Promise<void> {
  await page.addInitScript(
    ([areas, stored, tag, version]) => {
      const open = indexedDB.open('primordium', version);
      open.onupgradeneeded = () => {
        for (const area of areas) open.result.createObjectStore(area);
      };
      open.onsuccess = () => {
        const deal = open.result.transaction('catalog', 'readwrite');
        deal.objectStore('catalog').put(stored, 'bundle');
        deal.objectStore('catalog').put(tag, 'etag');
      };
    },
    [OFFLINE_AREAS, bundle, etag, DB_VERSION] as const,
  );
}

/** Answers as the service does: a known ETag gives 304 without a body.
 * The ETag counts only the species, so a new field does not change it. */
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

/** Opens the filter sheet. Each group in it is already open. */
async function openFilter(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
}

test('Die Gruppen des Filters füllen sich aus der Antwort des Dienstes', async ({ page }) => {
  await mockApi(page, { '/api/species/bundle': LIVE_BUNDLE });
  await page.goto('/arten');
  await expect(page.getByText('Steinpilz', { exact: true })).toBeVisible();

  await openFilter(page);

  await expect(page.getByRole('dialog').getByRole('button', { name: 'essbar', exact: true })).toBeVisible();
});

test('Ein Stand ohne Achsen weicht dem frischen Katalog', async ({ page }) => {
  await seedStore(page, STALE_BUNDLE, STALE_ETAG);
  await mockApi(page);
  await serveBundle(page, STALE_ETAG);
  await page.goto('/arten');
  await expect(page.getByText('Steinpilz', { exact: true })).toBeVisible();

  await openFilter(page);

  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'halbkugelig', exact: true }),
  ).toBeVisible();
});
