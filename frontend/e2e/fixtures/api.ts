import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Page } from '@playwright/test';

/** Die Antworten des Vertrags, die jede Seite beim Start holt. */
const REPLIES: Record<string, unknown> = {
  '/api/config': { oidcIssuer: '', oidcClientId: '', origin: '', version: 'e2e' },
  '/api/texts': { revision: 'e2e', locales: ['de', 'en'], entries: [] },
  '/api/me/permissions': { permissions: [], roles: [] },
  '/api/species/bundle': { items: [], standardColours: [], facets: {} },
  '/api/terms': { items: [] },
};

/** Ein Bild aus vier Brauntönen. Ohne Bild meldet der Abruf einen Fehler. */
const IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAH0lEQVR42mN4dHzWyRVZXdl22S7KDHAWUJQBzgKKAgBr/xJqbTqUmgAAAABJRU5ErkJggg==',
  'base64',
);

const IMAGE_PATH = '/api/photos/';

/** Womit die Attrappe eine Fotoanfrage beantwortet. */
export interface ApiOptions {
  /**
   * Eine Datei unter `e2e/boards/fixtures`, etwa `photo-358x269.png`. Eine
   * Tabelle wählt je Größe (`list`) oder je Bild und Größe (`eins/list`).
   */
  photo?: string | Record<string, string | undefined>;
}

/** Wählt die Fotoattrappe eines Bretts. Fehlt die Datei, bricht der Test ab. */
function photoOf(chosen: ApiOptions['photo'], id: string, size: string): Buffer {
  if (chosen === undefined) return IMAGE;
  const name = typeof chosen === 'string' ? chosen : (chosen[`${id}/${size}`] ?? chosen[size]);
  if (name === undefined) return IMAGE;
  return readFileSync(join(test.info().config.rootDir, 'boards/fixtures', name));
}

/** Legt die Vertrags-Attrappe auf die Seite. Ein Weg ohne Eintrag bleibt leer. */
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
