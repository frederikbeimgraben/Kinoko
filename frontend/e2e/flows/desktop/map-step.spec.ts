import { expect, test } from '../../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../../fixtures/api';
import { authConfig, mockSignIn } from '../../fixtures/auth';
import { MARKERS, SHARED_FINDS, SPECIES_BUNDLE, ZONES, mockMap } from '../../fixtures/map';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

const RAIL = 88;
const COLUMN = 400;

/** Vier Punkte über der Kartenfläche, im Uhrzeigersinn. */
const CORNERS: readonly (readonly [number, number])[] = [
  [700, 300],
  [900, 280],
  [950, 500],
  [720, 520],
];

/** Der Ort unter einem Punkt des Fensters. */
async function placeAt(page: Page, spot: readonly [number, number]): Promise<[number, number]> {
  return page.evaluate(
    ([x, y]) =>
      (window as unknown as { pilzMap: { aimAt: (a: number, b: number) => [number, number] } }).pilzMap.aimAt(
        x,
        y,
      ),
    spot,
  );
}

/** Der Zeiger über der Karte, wie ihn der Schritt setzt. */
async function cursorOfMap(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.querySelector('.map__canvas canvas');
    return canvas === null ? '' : getComputedStyle(canvas).cursor;
  });
}

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

  const bar = page.getByRole('group', { name: 'Zone zeichnen' });
  await expect(bar).toBeVisible();
  await expect(page.locator('.sheet__scrim')).toHaveCount(0);
  await expect(page.locator('app-sheet')).toHaveCount(0);

  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('Kein Fenster.');
  const box = await bar.boundingBox();
  if (box === null) throw new Error('Leiste ohne Fläche.');
  expect(Math.round(box.height)).toBe(64);
  expect(Math.round(viewport.height - (box.y + box.height))).toBe(16);
  expect(Math.round(box.x + box.width / 2)).toBe(Math.round((RAIL + COLUMN + viewport.width) / 2));

  await dragMap(page);

  await expect(bar).toBeVisible();

  for (const corner of CORNERS) await page.mouse.click(corner[0], corner[1]);
  await page.getByRole('button', { name: 'Abschließen' }).click();

  await expect(page.getByRole('dialog', { name: 'Zone speichern' })).toBeVisible();
});

test('Der Zeiger setzt die Ecken, die Rücktaste nimmt sie weg', async ({ page }) => {
  await openMap(page);
  await page.locator('.map__add').click();
  await page.getByRole('button', { name: 'Zone zeichnen' }).click();
  const bar = page.getByRole('group', { name: 'Zone zeichnen' });
  await expect(bar).toBeVisible();
  expect(await cursorOfMap(page)).toBe('crosshair');
  await expect(page.locator('app-crosshair')).toHaveCount(0);

  for (const corner of CORNERS) await page.mouse.click(corner[0], corner[1]);

  await expect(bar.getByText(/4 Eckpunkte/)).toBeVisible();

  await page.keyboard.press('Backspace');

  await expect(bar.getByText(/3 Eckpunkte/)).toBeVisible();
});

test('Ein Klick auf die erste Ecke schließt die Zone', async ({ page }) => {
  await openMap(page);
  await page.locator('.map__add').click();
  await page.getByRole('button', { name: 'Zone zeichnen' }).click();
  await expect(page.getByRole('group', { name: 'Zone zeichnen' })).toBeVisible();
  for (const corner of CORNERS) await page.mouse.click(corner[0], corner[1]);

  await page.mouse.click(CORNERS[0][0], CORNERS[0][1]);

  await expect(page.getByRole('dialog', { name: 'Zone speichern' })).toBeVisible();
});

test('Esc bricht den Schritt ab', async ({ page }) => {
  await openMap(page);
  await page.locator('.map__add').click();
  await page.getByRole('button', { name: 'Zone zeichnen' }).click();
  const bar = page.getByRole('group', { name: 'Zone zeichnen' });
  await expect(bar).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(bar).toHaveCount(0);
});

test('Ein Klick setzt den Fundort, ein zweiter verschiebt ihn', async ({ page }) => {
  await openMap(page);
  await page.locator('.map__add').click();
  await page.getByRole('button', { name: 'Fund melden' }).click();
  const bar = page.getByRole('group', { name: 'Fundort festlegen' });
  await expect(bar).toBeVisible();

  const note = bar.locator('.stepbar__note');
  await page.mouse.click(CORNERS[0][0], CORNERS[0][1]);
  await expect(note).not.toBeEmpty();
  const first = (await note.textContent()) ?? '';

  await page.mouse.click(CORNERS[2][0], CORNERS[2][1]);

  await expect(note).not.toHaveText(first);

  await page.getByRole('button', { name: 'Bestätigen' }).click();

  await expect(page.getByRole('dialog', { name: 'Fund melden' })).toBeVisible();
});

test('Die Marke lässt sich mit der Maus verschieben', async ({ page }) => {
  await openMap(page);
  await page.locator('.map__add').click();
  await page.getByRole('button', { name: 'Fund melden' }).click();
  const bar = page.getByRole('group', { name: 'Fundort festlegen' });
  await expect(bar).toBeVisible();
  const note = bar.locator('.stepbar__note');
  await page.mouse.click(CORNERS[0][0], CORNERS[0][1]);
  await expect(note).not.toBeEmpty();
  const first = (await note.textContent()) ?? '';
  const before = await placeAt(page, CORNERS[1]);

  // Ein Zug an der Marke schiebt sie, nicht die Karte.
  await page.mouse.move(CORNERS[0][0], CORNERS[0][1]);
  await page.mouse.down();
  await page.mouse.move(CORNERS[0][0] + 120, CORNERS[0][1] + 80, { steps: 10 });
  await page.mouse.up();

  await expect(note).not.toHaveText(first);
  // Die Karte bleibt stehen: der Zug gehört der Marke.
  expect(await placeAt(page, CORNERS[1])).toEqual(before);
});
