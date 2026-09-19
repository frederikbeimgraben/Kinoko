import { expect, test, type Page } from '@playwright/test';
import { mockApi } from '../../fixtures/api';
import { authConfig, mockSignIn } from '../../fixtures/auth';
import { MARKERS, SHARED_FINDS, SPECIES_BUNDLE, ZONES, mockMap } from '../../fixtures/map';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

const RAIL = 88;
const COLUMN = 400;

async function openMap(page: Page): Promise<void> {
  await mockSignIn(page);
  await mockApi(page, {
    '/api/species/bundle': SPECIES_BUNDLE,
    '/api/combinations': [],
    '/api/markers': MARKERS,
    '/api/zones': ZONES,
    '/api/finds': SHARED_FINDS,
    '/api/config': authConfig(BASE),
  });
  await mockMap(page);
  await page.goto('/karte');
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
}

/** Zieht quer über die Karte, wie beim Verschieben des Ausschnitts. */
async function dragMap(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('Kein Fenster.');
  const x = (RAIL + COLUMN + viewport.width) / 2;
  const y = viewport.height / 3;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 120, y + 90, { steps: 10 });
  await page.mouse.up();
}

test('Zone zeichnen bleibt am Rechner eine Leiste über der freien Karte', async ({ page }) => {
  await openMap(page);
  await page.locator('.map__add').click();
  await page.getByRole('button', { name: 'Zone zeichnen' }).click();

  const bar = page.getByRole('dialog', { name: 'Zone zeichnen' });
  await expect(bar).toBeVisible();
  await expect(bar).toHaveClass(/sheet--step/);
  await expect(page.locator('.sheet__scrim')).toHaveCount(0);
  await expect(page.locator('.sheet__handle')).toBeHidden();

  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('Kein Fenster.');
  const box = await bar.boundingBox();
  if (box === null) throw new Error('Leiste ohne Fläche.');
  expect(Math.round(box.height)).toBe(64);
  expect(Math.round(viewport.height - (box.y + box.height))).toBe(16);
  expect(Math.round(box.x + box.width / 2)).toBe(Math.round((RAIL + COLUMN + viewport.width) / 2));

  await dragMap(page);

  await expect(bar).toBeVisible();

  for (let corner = 0; corner < 3; corner += 1) {
    await page.getByRole('button', { name: 'Eckpunkt setzen' }).click();
  }
  await page.getByRole('button', { name: 'Zone abschließen' }).click();

  await expect(page.getByRole('dialog', { name: 'Zone speichern' })).toBeVisible();
});
