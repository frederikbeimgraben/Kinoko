import type { Page } from '@playwright/test';

/**
 * Eine graue Wertkachel von 256 Punkten. Byte 108 steht bei einem Höchstwert
 * von 0,5 für 21 Prozent, die Zahl aus dem Board `FindSheet`.
 */
const VALUE_TILE =
  'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAAAAAB5Gfe6AAABOElEQVR42u3QMQEAAAzDoAqO/3tCBhJYz02AAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAioA1qyBlVCtdTOAAAAAElFTkSuQmCC';

/** Legt eine Wertkachel und ihr Manifest auf die Seite. */
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
