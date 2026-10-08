import type { Page } from '@playwright/test';

/** A style without tiles. The base map is behind the tab on each page. */
const FLAT_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'grund', type: 'background', paint: { 'background-color': '#101512' } }],
};

/** Keeps the base map static, so that a tab on desktop shows the same image each time. */
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
