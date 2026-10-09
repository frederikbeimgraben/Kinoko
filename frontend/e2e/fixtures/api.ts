import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Page } from '@playwright/test';

/** The contract responses that each page gets at start. */
const REPLIES: Record<string, unknown> = {
  '/api/config': { oidcIssuer: '', oidcName: '', oidcClientId: '', origin: '', version: 'e2e' },
  '/api/texts': { revision: 'e2e', locales: ['de', 'en'], entries: [] },
  '/api/me/permissions': { permissions: [], roles: [] },
  '/api/species/bundle': { items: [], standardColours: [], facets: {} },
  '/api/terms': { items: [] },
  '/api/finds': { items: [], nextCursor: null },
  '/api/markers': { items: [], nextCursor: null },
  '/api/zones': { items: [], nextCursor: null },
  '/api/people/names': [],
};

/** An image of four brown tones. Without an image, the request gives an error. */
const IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAH0lEQVR42mN4dHzWyRVZXdl22S7KDHAWUJQBzgKKAgBr/xJqbTqUmgAAAABJRU5ErkJggg==',
  'base64',
);

const IMAGE_PATH = '/api/photos/';

/** What the mock gives for a photo request. */
export interface ApiOptions {
  /**
   * A file in `e2e/boards/fixtures`, e.g. `photo-358x269.png`, or a table by size (`list`) or by image and size (`eins/list`).
   */
  photo?: string | Record<string, string | undefined>;
}

/** Selects the photo mock of a board. If the file is missing, the test stops. */
function photoOf(chosen: ApiOptions['photo'], id: string, size: string): Buffer {
  if (chosen === undefined) return IMAGE;
  const name = typeof chosen === 'string' ? chosen : (chosen[`${id}/${size}`] ?? chosen[size]);
  if (name === undefined) return IMAGE;
  return readFileSync(join(test.info().config.rootDir, 'boards/fixtures', name));
}

/** Puts the contract mock on the page. A path without an entry stays empty. */
export async function mockApi(
  page: Page,
  extra: Record<string, unknown> = {},
  options: ApiOptions = {},
): Promise<void> {
  const table = { ...REPLIES, ...extra };
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith(IMAGE_PATH)) {
      const parts = path.split('/');
      const size = parts.pop() ?? '';
      const id = parts.pop() ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: photoOf(options.photo, id, size),
      });
      return;
    }
    const hit = table[path];
    if (hit === undefined) {
      await route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        body: '{"code":"not_found"}',
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(hit) });
  });
}
