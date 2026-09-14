import type { Page } from '@playwright/test';

/** Die Woche, die jedes Karten-Board zeigt. */
export const WEEK = { year: 2025, week: 40 };

/** Die Art, die jedes Karten-Board zeigt. */
export const SPECIES = 'boletus-edulis';

const SHARES = [0.18, 0.26, 0.4, 0.48, 0.62, 0.7, 0.88, 1];

function weeks(): unknown[] {
  return SHARES.map((share, index) => ({
    year: 2025,
    week: 33 + index,
    forecast: false,
    tiles: `boletus_edulis_kacheln/2025W${33 + index}`,
    mean: share,
    max: share,
  }));
}

/** Das Manifest der Art: acht Wochen, Höchstwert 0,5. */
export const SPECIES_MANIFEST = {
  species: ['Boletus edulis'],
  top: 0.5,
  bounds: [
    [47.2, 5.7],
    [55.1, 15.1],
  ],
  tiles: { zooms: [5, 8], have: {} },
  weeks: weeks(),
};

function share(count: number): { klassen: number[]; anteile: number[] } {
  const klassen = Array.from({ length: 41 }, (_, i) => (i * count) / 40);
  return { klassen, anteile: Array.from({ length: 40 }, () => 0.025) };
}

/** Die Eingabe-Ebenen, mit denselben Namen wie in den Boards. */
export const LAYERS_MANIFEST = {
  bounds: [
    [47.2, 5.7],
    [55.1, 15.1],
  ],
  layers: {
    regen_4w: {
      label: 'Niederschlag 4 Wochen',
      title: 'Niederschlag der letzten 4 Wochen',
      note: 'je Woche, 5-km-Raster, DWD HYRAS',
      unit: 'mm',
      low: 0,
      high: 152,
      tiles: 'layers_kacheln/regen_4w',
      zooms: [5, 8],
      weeks: ['2025W40'],
      histogramme: { '2025W40': share(240) },
    },
    niederschlag: {
      label: 'Niederschlag',
      note: 'Summe KW 37 bis 40',
      unit: 'mm',
      low: 0,
      high: 240,
      tiles: 'layers_kacheln/niederschlag',
      zooms: [5, 8],
      weeks: ['2025W40'],
      histogramme: { '2025W40': share(240) },
    },
    temperatur: {
      label: 'Mitteltemperatur',
      note: 'KW 40',
      unit: '°C',
      low: -5,
      high: 30,
      tiles: 'layers_kacheln/temperatur',
      zooms: [5, 8],
      weeks: ['2025W40'],
      histogramme: { '2025W40': share(30) },
    },
    bodenfeuchte: {
      label: 'Bodenfeuchte',
      note: 'KW 40',
      unit: '',
      low: 0,
      high: 1,
      tiles: 'layers_kacheln/bodenfeuchte',
      zooms: [5, 8],
      weeks: ['2025W40'],
      histogramme: { '2025W40': share(1) },
    },
    frosttage: {
      label: 'Frosttage',
      note: 'KW 40',
      unit: 'Tage',
      low: 0,
      high: 7,
      tiles: 'layers_kacheln/frosttage',
      zooms: [5, 8],
      weeks: ['2025W40'],
      histogramme: { '2025W40': share(7) },
    },
    hitzetage: {
      label: 'Hitzetage',
      note: 'KW 40',
      unit: 'Tage',
      low: 0,
      high: 7,
      tiles: 'layers_kacheln/hitzetage',
      zooms: [5, 8],
      weeks: ['2025W40'],
      histogramme: { '2025W40': share(7) },
    },
    buche: {
      label: 'Buche',
      note: 'Anteil der Waldfläche im Umkreis 1 km',
      unit: '',
      static: true,
      low: 0,
      high: 1,
      tiles: 'layers_kacheln/buche',
      zooms: [5, 8],
      histogramm: share(1),
    },
    hangneigung: {
      label: 'Hangneigung',
      note: 'Gelände, zeitlich konstant',
      unit: '°',
      static: true,
      low: 0,
      high: 45,
      tiles: 'layers_kacheln/hangneigung',
      zooms: [5, 8],
      histogramm: share(45),
    },
    boden_ph: {
      label: 'Boden pH',
      note: 'Oberboden, zeitlich konstant',
      unit: '',
      static: true,
      low: 3,
      high: 8,
      tiles: 'layers_kacheln/boden_ph',
      zooms: [5, 8],
      histogramm: share(8),
    },
  },
};

function species(slug: string, name: string, scientific: string): unknown {
  return {
    id: `00000000-0000-4000-8000-${slug.length.toString().padStart(12, '0')}`,
    slug,
    name,
    scientificName: scientific,
    group: 'mushroom',
    edibility: 'edible',
    protection: 'none',
    forecastEnabled: true,
    updatedAt: '2025-10-01T00:00:00Z',
    names: [],
    measurements: [],
    colours: [],
    colourChanges: [],
  };
}

/** Der Katalog vom Gerät: drei Arten mit Vorhersage, wie in den Boards. */
export const SPECIES_BUNDLE = {
  items: [
    species('boletus-edulis', 'Steinpilz', 'Boletus edulis'),
    species('cantharellus-cibarius', 'Pfifferling', 'Cantharellus cibarius'),
    species('imleria-badia', 'Maronenröhrling', 'Imleria badia'),
  ],
};

/** Die gespeicherten Kombinationen aus dem Board `Combinations`. */
export const COMBINATIONS = {
  items: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Herbst Steinpilz',
      rule: 'intersection',
      factors: [
        { source: 'niederschlag', condition: 'above', low: 80, high: null, active: true },
        { source: 'temperatur', condition: 'between', low: 8, high: 16, active: true },
        { source: 'buche', condition: 'above', low: 0.3, high: null, active: true },
        { source: 'hangneigung', condition: 'below', low: null, high: 15, active: true },
      ],
      updatedAt: '2025-10-01T00:00:00Z',
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Pfifferling Sommer',
      rule: 'graded',
      factors: [
        { source: 'niederschlag', condition: 'above', low: 60, high: null, active: true },
        { source: 'temperatur', condition: 'between', low: 12, high: 22, active: true },
        { source: 'bodenfeuchte', condition: 'above', low: 0.4, high: null, active: true },
      ],
      updatedAt: '2025-10-01T00:00:00Z',
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Frostfrei',
      rule: 'intersection',
      factors: [
        { source: 'frosttage', condition: 'below', low: null, high: 1, active: true },
        { source: 'temperatur', condition: 'above', low: 5, high: null, active: true },
      ],
      updatedAt: '2025-10-01T00:00:00Z',
    },
  ],
  nextCursor: null,
};

/** Die Faktoren aus dem Board `CombinationTab`, in der Reihenfolge des Boards. */
export const BOARD_FACTORS = [
  { source: 'niederschlag', condition: 'above', low: 80, high: 0, active: true },
  { source: 'temperatur', condition: 'between', low: 8, high: 16, active: true },
  { source: 'buche', condition: 'above', low: 0.3, high: 0, active: true },
  { source: 'hangneigung', condition: 'below', low: 0, high: 15, active: true },
  { source: 'boden_ph', condition: 'below', low: 0, high: 5.5, active: false },
];

/** Legt Manifeste und Kacheln auf die Seite. Kacheln bleiben leer. */
export async function mockTiles(page: Page): Promise<void> {
  await page.route('**/layers.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(LAYERS_MANIFEST),
    });
  });
  await page.route('**/*.json', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!/^\/[a-z0-9_-]+\.json$/.test(path)) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SPECIES_MANIFEST),
    });
  });
  await page.route('**/*.png', async (route) => {
    await route.fulfill({ status: 404, body: '' });
  });
}
