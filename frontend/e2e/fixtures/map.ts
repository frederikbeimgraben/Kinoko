import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Page } from '@playwright/test';
import {
  SPECIES_BUNDLE,
  LAYERS_MANIFEST,
  SPECIES_MANIFEST,
  COMBINATIONS,
  SHARED_FINDS,
  MARKERS,
  ZONES,
} from './map-data';

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
        opacity: 0.8,
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

/** Der Zustand der Blätter: wie viele es sind und wo das oberste steht. */
async function sheetState(page: Page): Promise<string> {
  return page.evaluate(() => {
    const tops = [...document.querySelectorAll('.sheet')].map((sheet) =>
      Math.round(sheet.getBoundingClientRect().top),
    );
    return `${tops.length}:${tops.length > 0 ? Math.min(...tops) : -1}`;
  });
}

/** Wartet, bis kein Blatt mehr in Bewegung ist. Sonst misst das Bild zu früh. */
async function settled(page: Page): Promise<void> {
  let seen = '';
  let same = 0;
  // Das Blatt fährt in 250 ms aus. Sechs gleiche Proben decken den Weg ab.
  while (same < 6) {
    const now = await sheetState(page);
    same = now === seen ? same + 1 : 0;
    seen = now;
    await page.waitForTimeout(50);
  }
}

/** Das Kartenbild eines Boards, als Datenadresse aus `boards/fixtures`. */
function fixtureImage(name: string): string {
  const path = join(test.info().config.rootDir, 'boards/fixtures', name);
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`;
}

/**
 * Legt das Kartenbild des Boards über die Zeichenfläche. Es füllt sie ganz,
 * unter den Knöpfen und dem Blatt der App.
 */
export async function showMapImage(page: Page, name: string): Promise<void> {
  await settled(page);
  await page.evaluate((source) => {
    const host = document.querySelector('.map__canvas');
    if (host === null) return;
    // Das Bild füllt den freien Streifen über dem obersten Blatt, wie im Board.
    const frame = host.getBoundingClientRect();
    const sheets = [...document.querySelectorAll('.sheet')].map((sheet) => sheet.getBoundingClientRect().top);
    const top = sheets.length > 0 ? Math.min(...sheets) : frame.bottom;
    const height = Math.max(0, Math.min(top, frame.bottom) - frame.top);
    const image = document.createElement('img');
    image.src = source;
    image.alt = '';
    image.setAttribute(
      'style',
      `position:absolute;inset-block-start:0;inset-inline-start:0;width:100%;height:${height}px;object-fit:fill;z-index:1`,
    );
    host.prepend(image);
  }, fixtureImage(name));
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>('.map__canvas img');
    return image?.complete === true;
  });
}

export { SPECIES_BUNDLE, LAYERS_MANIFEST, SPECIES_MANIFEST, COMBINATIONS, SHARED_FINDS, MARKERS, ZONES };
