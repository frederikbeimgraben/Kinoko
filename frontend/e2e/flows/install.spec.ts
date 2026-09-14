import { expect, test } from '@playwright/test';

/** Dieser Fluss prüft den Service Worker selbst und lässt ihn darum laufen. */
test.use({ serviceWorkers: 'allow' });

interface Manifest {
  name: string;
  short_name: string;
  id: string;
  start_url: string;
  scope: string;
  display: string;
  orientation: string;
  lang: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
  screenshots: { src: string; form_factor: string }[];
}

test('Installation: Manifest, Icons und Service Worker', async ({ page, baseURL }) => {
  await page.goto('/karte');

  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  expect(href).toBe('manifest.webmanifest');

  const reply = await page.request.get(new URL('manifest.webmanifest', baseURL).toString());
  expect(reply.status()).toBe(200);
  const manifest = (await reply.json()) as Manifest;
  expect(manifest.name).toBe('Primordium');
  expect(manifest.short_name).toBe('Primordium');
  expect(manifest.id).toBe('/');
  expect(manifest.start_url).toBe('/karte');
  expect(manifest.scope).toBe('/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.orientation).toBe('any');
  expect(manifest.lang).toBe('de');
  expect(manifest.theme_color).toMatch(/^#/);
  expect(manifest.background_color).toMatch(/^#/);

  const purposes = manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose}`);
  expect(purposes).toContain('192x192 any');
  expect(purposes).toContain('512x512 any');
  expect(purposes).toContain('512x512 maskable');
  for (const icon of manifest.icons) {
    const file = await page.request.get(new URL(icon.src, baseURL).toString());
    expect(file.status(), icon.src).toBe(200);
  }

  const factors = manifest.screenshots.map((shot) => shot.form_factor);
  expect(factors).toEqual(['narrow', 'wide']);

  await expect
    .poll(
      () => page.evaluate(() => navigator.serviceWorker.getRegistration().then((one) => one?.scope ?? null)),
      {
        timeout: 40_000,
      },
    )
    .toBe(new URL('/', baseURL).toString());
});
