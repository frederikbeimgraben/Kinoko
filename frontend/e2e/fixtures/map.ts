import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Page } from '@playwright/test';
import { SPECIES_BUNDLE, LAYERS_MANIFEST, SPECIES_MANIFEST, COMBINATIONS } from './map-data';

/**
 * Ein Stil ohne Kacheln. Die Grundkarte des Betriebs träfe im Test nie
 * zweimal dasselbe Bild.
 */
const FLAT_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'grund', type: 'background', paint: { 'background-color': '#101512' } }],
};

/** Der Stand der Karte, den jedes Board im Speicher des Geräts vorfindet. */
export interface BoardState {
  view?: 'forecast' | 'layer' | 'combination';
  detent?: 0 | 1 | 2;
  layer?: string;
  species?: string;
}

const STORAGE_KEY = 'pilzkarte.map.v1';
const COMBINATION_KEY = 'pilzkarte.combination.v1';

/** Die Faktoren aus dem Board `Kombination`, als Wert des Speichers. */
export const BOARD_FACTORS =
  'niederschlag:ge:80,temperatur:bw:8:16,buche:ge:0.3,hangneigung:le:15,!boden_ph:le:5.5';

/** Legt Zustand, Manifeste und Kacheln auf die Seite. Kacheln bleiben leer. */
export async function mockMap(page: Page, state: BoardState = {}, factors = ''): Promise<void> {
  await page.addInitScript(
    ([key, combinationKey, value, combination]) => {
      localStorage.setItem(key, value);
      localStorage.setItem(combinationKey, combination);
    },
    [
      STORAGE_KEY,
      COMBINATION_KEY,
      JSON.stringify({
        species: state.species ?? 'boletus-edulis',
        week: '2025-40',
        view: state.view ?? 'forecast',
        layer: state.layer ?? 'regen_4w',
        opacity: 1,
        background: 'map',
        forecastBelow: false,
        showMarkers: true,
        showZones: true,
        showSharedFinds: true,
        detent: state.detent ?? 1,
      }),
      JSON.stringify({ rule: 'intersection', factors }),
    ] as const,
  );
  await page.route(/\/[a-z0-9_-]+\.json$/, async (route) => {
    const layers = new URL(route.request().url()).pathname === '/layers.json';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(layers ? LAYERS_MANIFEST : SPECIES_MANIFEST),
    });
  });
  await page.route('https://tiles.openfreemap.org/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FLAT_STYLE),
    });
  });
  await page.route('**/*.png', async (route) => {
    await route.fulfill({ status: 404, body: '' });
  });
}

/** Das Kartenbild eines Boards, als Datenadresse aus `boards/fixtures`. */
function fixtureImage(name: string): string {
  const path = join(test.info().config.rootDir, 'boards/fixtures', name);
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`;
}

/**
 * Legt das Kartenbild des Boards über die Zeichenfläche. Es sitzt oben links
 * in voller Größe, unter den Knöpfen und dem Blatt der App.
 */
export async function showMapImage(page: Page, name: string): Promise<void> {
  await page.evaluate((source) => {
    const host = document.querySelector('.map__canvas');
    if (host === null) return;
    const image = document.createElement('img');
    image.src = source;
    image.alt = '';
    image.setAttribute(
      'style',
      'position:absolute;inset:0;width:100%;height:100%;object-fit:none;object-position:top left;z-index:1',
    );
    host.prepend(image);
  }, fixtureImage(name));
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>('.map__canvas img');
    return image?.complete === true;
  });
}

export { SPECIES_BUNDLE, LAYERS_MANIFEST, SPECIES_MANIFEST, COMBINATIONS };
