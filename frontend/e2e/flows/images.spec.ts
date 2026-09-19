import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { flatMap } from '../fixtures/flat-map';
import { bundle } from '../fixtures/species';
import {
  CHANTERELLE_SPECIES,
  QUEUE_PHOTOS,
  SPECIES_PHOTOS,
  STONE_SPECIES,
  photoPage,
} from '../fixtures/photos';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAH0lEQVR42mN4dHzWyRVZXdl22S7KDHAWUJQBzgKKAgBr/xJqbTqUmgAAAABJRU5ErkJggg==',
  'base64',
);

/** Meldet an und legt den Vertrag auf die Seite. */
async function start(page: Page, path: string, extra: Record<string, unknown>): Promise<void> {
  await mockSignIn(page);
  await mockApi(page, {
    '/api/config': authConfig(BASE),
    '/api/species/bundle': bundle([STONE_SPECIES, CHANTERELLE_SPECIES]),
    ...extra,
  });
  await flatMap(page);
  await page.goto(path);
}

/** Wählt ein Bild im Formular. */
async function pick(page: Page): Promise<void> {
  await page.locator('.form__file').setInputFiles({ name: 'pilz.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('.form__image')).toBeVisible();
}

/** Zieht die oberste Karte des Stapels nach rechts oder nach links. */
async function swipe(page: Page, direction: 1 | -1): Promise<void> {
  // Der Stapel steht still; die oberste Karte läuft nach einer Entscheidung zurück.
  const box = await page.locator('.queue__stack').boundingBox();
  if (box === null) throw new Error('keine Karte');
  const y = box.y + box.height / 2;
  const from = direction === 1 ? box.x + 16 : box.x + box.width - 16;
  await page.mouse.move(from, y);
  await page.mouse.down();
  await page.mouse.move(from + direction * 200, y, { steps: 10 });
  await page.mouse.up();
}

test('Ein Bild geht mit Anteil hinaus', async ({ page }) => {
  const sent: string[] = [];
  await start(page, '/arten/boletus-edulis/bilder/neu', {
    '/api/photos': photoPage(SPECIES_PHOTOS),
    '/api/me/permissions': { permissions: [], roles: [] },
  });
  await expect(page.getByRole('heading', { name: 'Bild einreichen' })).toBeVisible();
  await pick(page);
  await page.route('**/api/photos', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    sent.push(route.request().method());
    // Die Antwort bleibt aus: der Anteil steht auf der Kachel.
    await new Promise(() => undefined);
  });

  await page.getByRole('button', { name: 'Zur Prüfung einreichen' }).click();

  await expect(page.locator('.form__progress')).toBeVisible();
  await expect.poll(() => sent.length).toBe(1);
});

test('Ohne Netz wartet die Einreichung und geht bei Netz hinaus', async ({ page }) => {
  const posts: string[] = [];
  let down = false;
  await start(page, '/arten/boletus-edulis/bilder/neu', {
    '/api/photos': photoPage(SPECIES_PHOTOS),
    '/api/me/permissions': { permissions: [], roles: [] },
  });
  await pick(page);
  await page.route('**/api/photos', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    if (down) {
      await route.abort('internetdisconnected');
      return;
    }
    posts.push(route.request().url());
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });
  const say = (kind: string): Promise<void> =>
    page.evaluate((name) => {
      dispatchEvent(new Event(name));
    }, kind);
  down = true;
  await say('offline');

  await page.getByRole('button', { name: 'Zur Prüfung einreichen' }).click();
  await expect(page).toHaveURL(/\/arten\/boletus-edulis$/);
  expect(posts).toEqual([]);

  down = false;
  await say('online');

  await expect.poll(() => posts.length, { timeout: 10_000 }).toBe(1);
});

test('Wischen rechts nimmt an, wischen links fragt nach dem Grund', async ({ page }) => {
  const decided: string[] = [];
  await start(page, '/verwaltung/bilder', {
    '/api/photos': photoPage(QUEUE_PHOTOS),
    '/api/me/permissions': { permissions: ['image.review'], roles: [] },
  });
  await expect(page.getByText('Junge Exemplare im Moos')).toBeVisible();
  await page.route('**/api/photos/*/approval', async (route) => {
    decided.push(new URL(route.request().url()).pathname);
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/photos/*/rejection', async (route) => {
    decided.push(`${new URL(route.request().url()).pathname} ${route.request().postData() ?? ''}`);
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await swipe(page, 1);

  await expect.poll(() => decided).toEqual(['/api/photos/einreichung-eins/approval']);
  await expect(page.getByText('2 von 4')).toBeVisible();

  await swipe(page, -1);

  await expect(page.getByRole('dialog', { name: 'Warum lehnst du ab?' })).toBeVisible();
  await page.getByRole('button', { name: 'Unscharf' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ablehnen' }).click();

  await expect
    .poll(() => decided.at(-1))
    .toBe('/api/photos/einreichung-zwei/rejection {"reason":"Unscharf"}');
});
