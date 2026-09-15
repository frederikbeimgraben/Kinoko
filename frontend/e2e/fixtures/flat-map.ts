import type { Page } from '@playwright/test';

/** Ein Stil ohne Kacheln. Die Grundkarte steht auf jeder Seite hinter dem Reiter. */
const FLAT_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'grund', type: 'background', paint: { 'background-color': '#101512' } }],
};

/** Hält die Grundkarte still, damit ein Reiter am Rechner dasselbe Bild zeigt. */
export async function flatMap(page: Page): Promise<void> {
  await page.route('https://tiles.openfreemap.org/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FLAT_STYLE),
    });
  });
  await page.route(/\/[a-z0-9_-]+\.json$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"layers":[]}' });
  });
}
