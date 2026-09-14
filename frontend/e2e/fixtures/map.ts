import type { Page } from '@playwright/test';
import { SPECIES_BUNDLE, LAYERS_MANIFEST, SPECIES_MANIFEST, COMBINATIONS } from './map-data';

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
  // Die Grundkarte darf im Test nicht ins Netz: ihr Bild wäre nie dasselbe.
  await page.route('https://tiles.openfreemap.org/**', async (route) => {
    await route.fulfill({ status: 404, body: '' });
  });
  await page.route('**/*.png', async (route) => {
    await route.fulfill({ status: 404, body: '' });
  });
}

export { SPECIES_BUNDLE, LAYERS_MANIFEST, SPECIES_MANIFEST, COMBINATIONS };
