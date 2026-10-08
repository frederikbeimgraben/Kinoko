import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Page } from '@playwright/test';
import {
  SPECIES_BUNDLE,
  LAYERS_MANIFEST,
  FICHTE_LAYERS_MANIFEST,
  SPECIES_MANIFEST,
  COMBINATIONS,
  SHARED_FINDS,
  MARKERS,
  ZONES,
} from './map-data';

/** A style without tiles. The live base map never gives the same image twice in a test. */
const FLAT_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'grund', type: 'background', paint: { 'background-color': '#101512' } }],
};

/** The map state that each board finds in the storage of the device. */
export interface BoardState {
  view?: 'forecast' | 'layer' | 'combination';
  detent?: 0 | 1 | 2;
  layer?: string;
  species?: string;
  /** A style without a background: the map image is then below the drawing. */
  clear?: boolean;
  /** The zones on the map. Board `MapLayers` shows them off. */
  zones?: boolean;
}

const STORAGE_KEY = 'pilzkarte.map.v1';
const COMBINATION_KEY = 'pilzkarte.combination.v1';

/** The factors of the combination boards, as a stored value. */
export const BOARD_FACTORS = 'regen:ge:80,temperatur:bw:12:18';

/** Today for each board: KW 38 of the fixtures is the current week. */
const BOARD_NOW = '2026-09-17T12:00:00Z';

/** Gives the page the state, the manifests and the tiles. The tiles stay empty. */
export async function mockMap(
  page: Page,
  state: BoardState = {},
  factors = '',
  layersManifest: unknown = LAYERS_MANIFEST,
): Promise<void> {
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
        layer: state.layer ?? 'regen',
        opacity: 0.7,
        background: 'light',
        forecastBelow: false,
        showMarkers: true,
        showZones: state.zones ?? true,
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
      body: JSON.stringify(layers ? layersManifest : SPECIES_MANIFEST),
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

/** The state of the sheets: how many there are and where the top one is. */
async function sheetState(page: Page): Promise<string> {
  return page.evaluate(() => {
    const tops = [...document.querySelectorAll('.sheet')].map((sheet) =>
      Math.round(sheet.getBoundingClientRect().top),
    );
    return `${tops.length}:${tops.length > 0 ? Math.min(...tops) : -1}`;
  });
}

/** Waits until no sheet moves. Else the screenshot is too early. */
async function settled(page: Page): Promise<void> {
  let seen = '';
  let same = 0;
  // The sheet moves in for 250 ms. Six equal samples cover the movement.
  while (same < 6) {
    const now = await sheetState(page);
    same = now === seen ? same + 1 : 0;
    seen = now;
    await page.waitForTimeout(50);
  }
}

/** The map image of a board, as a data URL from `boards/fixtures`. */
function fixtureImage(name: string): string {
  const path = join(test.info().config.rootDir, 'boards/fixtures', name);
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`;
}

/** Puts the map image of the board over the canvas, below the buttons and the sheet of the app. */
export async function showMapImage(page: Page, name: string, fixed?: number, under = false): Promise<void> {
  await settled(page);
  await page.evaluate(
    ([source, given, below]) => {
      const host = document.querySelector('.map__canvas');
      if (host === null) return;
      // The image fills the free strip above the top sheet, as on the board.
      const frame = host.getBoundingClientRect();
      // A modal floats over the map. Only a sheet from below makes the map shorter.
      const sheets = [...document.querySelectorAll('.sheet:not(.sheet--modal)')].map(
        (sheet) => sheet.getBoundingClientRect().top,
      );
      const top = sheets.length > 0 ? Math.min(...sheets) : frame.bottom;
      // A board whose map continues below the sheet gives its height.
      const height = given ?? Math.max(0, Math.min(top, frame.bottom) - frame.top);
      const image = document.createElement('img');
      image.src = source;
      image.alt = '';
      // Below the canvas, the layers that the map paints stay visible.
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

/** The heat of the design map surface: the forecast, the rain or none. */
export type DesignHeat = 'forecast' | 'rain' | 'none';

/** How the design map surface of a board looks. */
export interface DesignMap {
  heat?: DesignHeat;
  rotated?: boolean;
  /** A fixed height in px. Without it, the surface fills the canvas. */
  height?: number;
  /** The surface ends this number of px below the top of the map sheet, as in the kit `.sheet`. */
  belowSheet?: number;
  /** The surface is below the drawing of the map, so a zone or a mark of the app shows on it. */
  under?: boolean;
}

/** The kit `.karte`, `.turn` and `.heat` of `kit.css`. The boards draw this surface, not a real map.
 * The road is in `.turn`, so `.karte>svg` does not apply: it is a square as wide as the map. */
const KARTE =
  'position:absolute;inset-block-start:0;inset-inline-start:0;width:100%;overflow:hidden;pointer-events:none;background:' +
  'radial-gradient(120px 90px at 22% 18%,#dfe8d6 0,transparent 100%),' +
  'radial-gradient(160px 120px at 78% 30%,#d3dfcb 0,transparent 100%),' +
  'radial-gradient(200px 140px at 40% 62%,#d8e3d0 0,transparent 100%),' +
  'linear-gradient(180deg,#eef2ea,#e4ebe0)';
const TURN = 'position:absolute;inset:0';
const TURNED = 'position:absolute;inset:-30%;transform:rotate(-28deg)';
const HEAT: Record<Exclude<DesignHeat, 'none'>, string> = {
  forecast:
    'radial-gradient(38% 34% at 30% 34%,#b5367a 0,transparent 100%),' +
    'radial-gradient(34% 30% at 62% 22%,#f1605d 0,transparent 100%),' +
    'radial-gradient(40% 36% at 52% 56%,#cd4071 0,transparent 100%),' +
    'radial-gradient(30% 30% at 84% 58%,#feb078 0,transparent 100%),' +
    'radial-gradient(28% 30% at 14% 70%,#721f81 0,transparent 100%)',
  rain:
    'radial-gradient(40% 36% at 28% 30%,#2c6fa3 0,transparent 100%),' +
    'radial-gradient(36% 32% at 66% 24%,#5aa4c9 0,transparent 100%),' +
    'radial-gradient(42% 38% at 50% 60%,#1f4e86 0,transparent 100%),' +
    'radial-gradient(30% 30% at 84% 62%,#9fd0de 0,transparent 100%)',
};
const ROAD =
  '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
  '<path d="M0 74 C18 66 30 80 50 76 S78 60 100 70" fill="none" stroke="#9aa3c4" stroke-width=".900" opacity=".700"></path></svg>';

/** Puts the design map surface of `MapView` over the canvas, below the buttons and the sheets.
 * The design draws CSS gradients, so the board compares the app frame, not the map engine. */
export async function showDesignMap(page: Page, map: DesignMap = {}): Promise<void> {
  await settled(page);
  const heat = map.heat ?? 'forecast';
  const turn = map.rotated ? TURNED : TURN;
  const inner =
    `<div style="${turn}">${ROAD}` +
    (heat === 'none'
      ? ''
      : `<div style="position:absolute;inset:0;mix-blend-mode:multiply;opacity:.9;background:${HEAT[heat]}"></div>`) +
    '</div>';
  await page.evaluate(
    ([karte, html, fixed, below, under]) => {
      const host = document.querySelector('.map__canvas');
      if (host === null) return;
      const frame = host.getBoundingClientRect();
      const sheet = document.querySelector('.map__sheet .sheet');
      const height =
        fixed ??
        (below !== null && sheet !== null
          ? sheet.getBoundingClientRect().top + below - frame.top
          : frame.height);
      const surface = document.createElement('div');
      surface.className = 'design-map';
      surface.setAttribute('style', `${karte};height:${height}px;z-index:${under ? 0 : 1}`);
      surface.innerHTML = html;
      host.prepend(surface);
    },
    [KARTE, inner, map.height ?? null, map.belowSheet ?? null, map.under ?? false] as const,
  );
}

export {
  SPECIES_BUNDLE,
  LAYERS_MANIFEST,
  FICHTE_LAYERS_MANIFEST,
  SPECIES_MANIFEST,
  COMBINATIONS,
  SHARED_FINDS,
  MARKERS,
  ZONES,
};
