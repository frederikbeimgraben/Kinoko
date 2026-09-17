import { expect, test, type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { ROW_PHOTO } from '../fixtures/photos';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { SPECIES_BUNDLE, mockMap } from '../fixtures/map';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** Ein Board gehört zu einem Gerät und läuft nicht, solange es aussteht. */
function guard(board: string, device: 'phone' | 'desktop'): void {
  test.skip(test.info().project.name !== device, `Board gehört zu ${device}`);
  skipPending(board);
}

/** Die zwei Marker aus dem Board `EntriesMarkers`. */
const MARKERS = {
  items: [
    {
      id: 'marker-eins',
      name: 'Alter Fichtenbestand',
      lat: 48.52,
      lon: 9.05,
      colour: 'blue',
      note: 'Schönbuch',
      visibility: 'private',
      updatedAt: '2026-09-01T08:00:00Z',
      deleted: false,
    },
    {
      id: 'marker-zwei',
      name: 'Parkplatz Nord',
      lat: 48.6,
      lon: 9.1,
      colour: 'brown',
      note: 'Odenwald',
      visibility: 'shared',
      updatedAt: '2026-09-02T08:00:00Z',
      deleted: false,
    },
  ],
  nextCursor: null,
};

/** Ein Viereck mit der gewünschten Fläche, als Rechteck um den Nullpunkt. */
function square(hectares: number): Record<string, unknown> {
  const side = Math.sqrt(hectares * 10_000);
  const degrees = side / 111_320;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [9, 48],
        [9 + degrees / Math.cos((48 * Math.PI) / 180), 48],
        [9 + degrees / Math.cos((48 * Math.PI) / 180), 48 + degrees],
        [9, 48 + degrees],
        [9, 48],
      ],
    ],
  };
}

/** Die zwei Zonen aus dem Board `EntriesZones`. */
const ZONES = {
  items: [
    {
      id: 'zone-eins',
      name: 'Schönbuch Nord',
      colour: 'green',
      polygon: square(42),
      areaHa: 42,
      note: null,
      visibility: 'private',
      updatedAt: '2026-09-01T08:00:00Z',
      deleted: false,
    },
    {
      id: 'zone-zwei',
      name: 'Odenwald Ost',
      colour: 'red',
      polygon: square(18),
      areaHa: 18,
      note: null,
      visibility: 'shared',
      updatedAt: '2026-09-02T08:00:00Z',
      deleted: false,
    },
  ],
  nextCursor: null,
};

const REPLIES = {
  '/api/species/bundle': SPECIES_BUNDLE,
  '/api/markers': MARKERS,
  '/api/zones': ZONES,
  '/api/finds': { items: [], nextCursor: null },
};

async function openEntries(page: Page, signedIn = true): Promise<void> {
  if (signedIn) await mockSignIn(page);
  await mockApi(page, { ...REPLIES, '/api/config': authConfig(BASE) }, { photo: ROW_PHOTO });
  await page.goto('/eintraege');
  await expect(page.getByRole('heading', { name: 'Einträge' })).toBeVisible();
}

test('EntriesMarkers', async ({ page }) => {
  guard('EntriesMarkers', 'phone');
  await openEntries(page);
  await page.getByRole('tab', { name: 'Marker' }).click();
  await expect(page.getByText('Alter Fichtenbestand')).toBeVisible();
  await expectBoard(page, 'EntriesMarkers');
});

test('EntriesZones', async ({ page }) => {
  guard('EntriesZones', 'phone');
  await openEntries(page);
  await page.getByRole('tab', { name: 'Zonen' }).click();
  await expect(page.getByText('Schönbuch Nord')).toBeVisible();
  await expectBoard(page, 'EntriesZones');
});

/** Der Fund, den der Dienst schon kennt. Er steht unter den wartenden. */
const SENT_FIND = {
  items: [
    {
      id: 'find-eins',
      lat: 48.52,
      lon: 9.05,
      speciesId: '00000000-0000-4000-8000-000000000014',
      foundOn: '2025-09-06',
      count: 3,
      reviewState: 'accepted',
      visibility: 'private',
      note: 'unter Fichten',
      updatedAt: '2025-09-06T08:00:00Z',
      deleted: false,
    },
  ],
  nextCursor: null,
};

/** Meldet einen Fund über das Fadenkreuz. Ohne Netz wartet er im Gerät. */
async function reportFind(page: Page, species: string | null, count: string, note?: string): Promise<void> {
  await page.getByRole('button', { name: 'Eintragen' }).click();
  await page.getByRole('button', { name: 'Fund melden' }).click();
  await page.getByRole('button', { name: 'Fundort übernehmen' }).click();
  const form = page.getByRole('dialog', { name: 'Fund melden' });
  await expect(form.getByRole('heading', { name: 'Fund melden' })).toBeVisible();
  if (species !== null) {
    await form.getByRole('button', { name: 'Steinpilz', exact: true }).click();
    await form.getByRole('button', { name: new RegExp(species) }).click();
  }
  await form.getByRole('spinbutton', { name: 'Anzahl' }).fill(count);
  if (note !== undefined) await form.getByRole('textbox', { name: 'Notiz' }).fill(note);
  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { name: 'Fund melden' })).toHaveCount(0);
}

test('EntriesOffline', async ({ page }) => {
  guard('EntriesOffline', 'phone');
  let down = false;
  await mockSignIn(page);
  await mockApi(
    page,
    {
      ...REPLIES,
      '/api/markers': { items: [], nextCursor: null },
      '/api/zones': { items: [], nextCursor: null },
      '/api/finds': SENT_FIND,
      '/api/config': authConfig(BASE),
    },
    { photo: ROW_PHOTO },
  );
  // Geteilte Funde holt die Liste getrennt. Das Brett zeigt nur eigene.
  await page.route(
    (url) => url.pathname === '/api/finds' && url.searchParams.get('mine') === 'false',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"items":[],"nextCursor":null}',
      });
    },
  );
  // Ohne Netz scheitert nur das Schreiben. Lesen bleibt bei dem, was da ist.
  await page.route('**/api/**', async (route) => {
    if (down && route.request().method() !== 'GET') {
      await route.abort('internetdisconnected');
      return;
    }
    await route.fallback();
  });
  await mockMap(page, { detent: 1 });
  await page.goto('/karte');
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
  down = true;
  await page.evaluate(() => {
    dispatchEvent(new Event('offline'));
  });

  await reportFind(page, 'Pfifferling', '2', 'unter Fichten am Hang');
  await reportFind(page, null, '1');

  await page.getByRole('link', { name: 'Einträge' }).click();
  await expect(page.getByText('Übertragung ausstehend').first()).toBeVisible();
  // Die Meldungen der Toasts gehen von selbst; das Brett zeigt sie nicht.
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 20_000 });
  await expectBoard(page, 'EntriesOffline');
});
