import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { ROW_PHOTO } from '../fixtures/photos';
import { authConfig, mockSignedOut, mockSignIn } from '../fixtures/auth';
import { SPECIES_BUNDLE, mockMap } from '../fixtures/map';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** A board belongs to one device and does not run while it is pending. */
function guard(board: string, device: 'phone' | 'desktop'): void {
  test.skip(test.info().project.name !== device, `board belongs to ${device}`);
  skipPending(board);
}

/** The two markers of the board `EntriesMarkers`. */
const MARKERS = {
  items: [
    {
      id: 'marker-one',
      name: 'Alter Fichtenbestand',
      lat: 48.52,
      lon: 9.05,
      colour: 'blue',
      note: 'Guter Steinpilzplatz, Nordhang',
      visibility: 'private',
      createdAt: '2026-09-12T08:00:00Z',
      updatedAt: '2026-09-12T08:00:00Z',
      deleted: false,
    },
    {
      id: 'marker-two',
      name: 'Parkplatz Schönbuch',
      lat: 48.6,
      lon: 9.1,
      colour: 'grey',
      note: null,
      visibility: 'private',
      createdAt: '2026-08-30T08:00:00Z',
      updatedAt: '2026-08-30T08:00:00Z',
      deleted: false,
    },
  ],
  nextCursor: null,
};

/** A square with the wanted area, as a rectangle at the origin. */
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

/** The zone of the board `EntriesZones`. */
const ZONES = {
  items: [
    {
      id: 'zone-one',
      name: 'Schönbuch Nord',
      colour: 'green',
      polygon: square(42),
      areaHa: 42,
      note: 'Nordhang, alte Fichten',
      visibility: 'private',
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-01T08:00:00Z',
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
  else await mockSignedOut(page);
  await mockApi(page, { ...REPLIES, '/api/config': authConfig(BASE) }, { photo: ROW_PHOTO });
  await page.goto('/eintraege');
  await expect(page.getByRole('heading', { name: 'Einträge' })).toBeVisible();
}

test('EntriesMarkers', async ({ page }) => {
  guard('EntriesMarkers', 'phone');
  await openEntries(page);
  await page.getByRole('button', { name: 'Marker', exact: true }).click();
  await expect(page.getByText('Alter Fichtenbestand')).toBeVisible();
  await expectBoard(page, 'EntriesMarkers');
});

test('EntriesZones', async ({ page }) => {
  guard('EntriesZones', 'phone');
  await openEntries(page);
  await page.getByRole('button', { name: 'Zonen', exact: true }).click();
  await expect(page.getByText('Schönbuch Nord')).toBeVisible();
  await expectBoard(page, 'EntriesZones');
});

test('EntriesGuest', async ({ page }) => {
  guard('EntriesGuest', 'phone');
  await openEntries(page, false);
  await expect(page.getByText('Nicht angemeldet')).toBeVisible();
  await expectBoard(page, 'EntriesGuest');
});

/** The find that the service knows already. It is below the pending finds. */
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

/** Reports a find with the crosshair. Without network it waits on the device. */
async function reportFind(page: Page, species: string | null, count: string, note?: string): Promise<void> {
  await page.getByRole('button', { name: 'Eintragen' }).click();
  await page.getByRole('button', { name: 'Fund melden' }).click();
  await page.getByRole('button', { name: 'Bestätigen' }).click();
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
  // The list gets the shared finds in a request of its own. The board shows only own finds.
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
  // Without network only a write fails. A read keeps what is there.
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
  // The fixed clock moves on: else the queue puts entries of the same age in a random order.
  const now = await page.evaluate(() => Date.now());
  await page.clock.setFixedTime(new Date(now + 1000));
  await reportFind(page, null, '1');

  await page.getByRole('link', { name: 'Einträge' }).click();
  await expect(page.getByRole('img', { name: 'Übertragung ausstehend' }).first()).toBeVisible();
  // The toasts go away by themselves; the board does not show them.
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 20_000 });
  await expectBoard(page, 'EntriesOffline');
});
