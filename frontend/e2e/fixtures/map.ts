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
  /** Ein Stil ohne Grundfläche: das Kartenbild liegt dann unter der Zeichnung. */
  clear?: boolean;
}

const STORAGE_KEY = 'pilzkarte.map.v1';
const COMBINATION_KEY = 'pilzkarte.combination.v1';

/** Die Faktoren aus den Boards der Kombination, als Wert des Speichers. */
export const BOARD_FACTORS = 'regen:ge:80';

/** Heute, für jedes Board: KW 40 der Fixtures gilt als laufende Woche. */
const BOARD_NOW = '2025-10-02T12:00:00Z';

/** Legt Zustand, Manifeste und Kacheln auf die Seite. Kacheln bleiben leer. */
export async function mockMap(page: Page, state: BoardState = {}, factors = ''): Promise<void> {
  await page.clock.setFixedTime(new Date(BOARD_NOW));
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
      body: JSON.stringify(state.clear ? { ...FLAT_STYLE, layers: [] } : FLAT_STYLE),
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
export async function showMapImage(page: Page, name: string, fixed?: number, under = false): Promise<void> {
  await settled(page);
  await page.evaluate(
    ([source, given, below]) => {
      const host = document.querySelector('.map__canvas');
      if (host === null) return;
      // Das Bild füllt den freien Streifen über dem obersten Blatt, wie im Board.
      const frame = host.getBoundingClientRect();
      // Ein Modal schwebt über der Karte. Nur ein Blatt von unten kürzt sie.
      const sheets = [...document.querySelectorAll('.sheet:not(.sheet--modal)')].map(
        (sheet) => sheet.getBoundingClientRect().top,
      );
      const top = sheets.length > 0 ? Math.min(...sheets) : frame.bottom;
      // Ein Board, dessen Karte unter dem Blatt weiterläuft, gibt seine Höhe vor.
      const height = given ?? Math.max(0, Math.min(top, frame.bottom) - frame.top);
      const image = document.createElement('img');
      image.src = source;
      image.alt = '';
      // Unter der Zeichenfläche bleibt sichtbar, was die Karte selbst malt.
      image.setAttribute(
        'style',
        `position:absolute;inset-block-start:0;inset-inline-start:0;width:100%;height:${height}px;object-fit:fill;z-index:${below ? 0 : 1}`,
      );
      host.prepend(image);
    },
    [fixtureImage(name), fixed, under] as const,
  );
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>('.map__canvas img');
    return image?.complete === true;
  });
}

export { SPECIES_BUNDLE, LAYERS_MANIFEST, SPECIES_MANIFEST, COMBINATIONS, SHARED_FINDS, MARKERS, ZONES };
