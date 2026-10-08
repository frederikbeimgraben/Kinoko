import type { Page } from '@playwright/test';

/**
 * A grey value tile of 256 px. At a maximum of 0.5, byte 108 gives 21 %, the number of the `FindSheet` board.
 */
const VALUE_TILE =
  'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAAAAAB5Gfe6AAABOElEQVR42u3QMQEAAAzDoAqO/3tCBhJYz02AAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAioA1qyBlVCtdTOAAAAAElFTkSuQmCC';

/** Puts a value tile and its manifest on the page. */
export async function mockValueTile(page: Page, slug: string, manifest: unknown): Promise<void> {
  await page.route(`**/${slug}.json`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(manifest),
    });
  });
  await page.route('**/*_kacheln/**/*.png', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(VALUE_TILE, 'base64'),
    });
  });
}
