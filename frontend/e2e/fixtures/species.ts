/** Die Attrappen des Artenkatalogs für Boards und Flüsse. */

type Hex = string;

interface Shape {
  slug: string;
  name: string;
  latin: string;
  edibility: string;
  cap?: readonly Hex[];
  stem?: readonly Hex[];
  gills?: readonly Hex[];
  flesh?: readonly Hex[];
  sporePrint?: readonly Hex[];
  hymenium?: string | null;
  capShapes?: readonly string[];
  months?: readonly [number, number];
  capWidth?: readonly [number, number];
  stemHeight?: readonly [number, number];
  stemThickness?: readonly [number, number];
  protection?: string;
  forecast?: boolean;
  group?: string;
}

function colours(part: string, hexes: readonly Hex[] | undefined): unknown[] {
  if (hexes === undefined || hexes.length === 0) return [];
  return [{ part, mode: 'single', colours: hexes.map((hex) => ({ name: hex, hex })) }];
}

function sizes(entry: Shape): unknown[] {
  const cap = entry.capWidth ? [{ part: 'cap', measurements: [measure('width', entry.capWidth)] }] : [];
  const stemRows = [];
  if (entry.stemHeight) stemRows.push(measure('height', entry.stemHeight));
  if (entry.stemThickness) stemRows.push(measure('thickness', entry.stemThickness));
  return [...cap, ...(stemRows.length ? [{ part: 'stem', measurements: stemRows }] : [])];
}

function measure(dimension: string, span: readonly [number, number]): unknown {
  return { dimension, unit: 'cm', low: span[0], high: span[1], rareLow: null, rareHigh: null };
}

/** Baut eine Art in der Form des Vertrags. */
export function species(entry: Shape, at = 0): Record<string, unknown> {
  return {
    id: `00000000-0000-4000-8000-${String(at).padStart(12, '0')}`,
    slug: entry.slug,
    name: entry.name,
    scientificName: entry.latin,
    taxonId: null,
    group: entry.group ?? 'bolete',
    edibility: entry.edibility,
    protection: entry.protection ?? 'none',
    forecastEnabled: entry.forecast ?? false,
    leadPhotoId: `00000000-0000-4000-9000-${String(at).padStart(12, '0')}`,
    updatedAt: '2026-01-01T00:00:00Z',
    description: null,
    marketable: false,
    hymeniumType: entry.hymenium ?? null,
    capShapeYoung: entry.capShapes?.[0] ?? null,
    capShapeOld: entry.capShapes?.[1] ?? null,
    periodStartMonth: entry.months?.[0] ?? null,
    periodEndMonth: entry.months?.[1] ?? null,
    periodPeakMonth: null,
    names: [],
    measurements: sizes(entry),
    colours: [
      ...colours('cap', entry.cap),
      ...colours('stem', entry.stem),
      ...colours('gills', entry.gills),
      ...colours('flesh', entry.flesh),
      ...colours('spore_print', entry.sporePrint),
    ],
    colourChanges: [],
    capFeatures: [],
    capMargins: [],
    stemFeatures: [],
    traits: [],
    sources: [],
    seasons: [],
    terms: [],
    lookalikes: [],
  };
}

/** Ein Bündel aus einer Liste von Arten. */
export function bundle(entries: readonly Shape[]): Record<string, unknown> {
  return { items: entries.map((entry, at) => species(entry, at)) };
}

/** Die sieben Arten des Bretts `Species`. */
export const SEVEN: readonly Shape[] = [
  {
    slug: 'boletus-edulis',
    name: 'Steinpilz',
    latin: 'Boletus edulis',
    edibility: 'edible',
    cap: ['#7a5230', '#c9a877'],
  },
  {
    slug: 'imleria-badia',
    name: 'Maronenröhrling',
    latin: 'Imleria badia',
    edibility: 'edible',
    cap: ['#8a4e2b', '#4a3220'],
  },
  {
    slug: 'cantharellus-cibarius',
    name: 'Pfifferling',
    latin: 'Cantharellus cibarius',
    edibility: 'edible',
    cap: ['#d9a441', '#e8c86a'],
  },
  {
    slug: 'amanita-phalloides',
    name: 'Grüner Knollenblätterpilz',
    latin: 'Amanita phalloides',
    edibility: 'deadly',
    cap: ['#4a5a3a', '#8a9a5a'],
  },
  {
    slug: 'amanita-pantherina',
    name: 'Pantherpilz',
    latin: 'Amanita pantherina',
    edibility: 'poisonous',
    cap: ['#4a5a3a', '#8a9a5a'],
  },
  {
    slug: 'hydnum-repandum',
    name: 'Semmelstoppelpilz',
    latin: 'Hydnum repandum',
    edibility: 'edible',
    cap: ['#e2c79a', '#c9a877'],
  },
  {
    slug: 'morchella-esculenta',
    name: 'Speisemorchel',
    latin: 'Morchella esculenta',
    edibility: 'edible',
    cap: ['#6b5a3a', '#b89a6a'],
  },
];

/** Die drei Treffer des Bretts `SpeciesSearch`. */
export const STONE: readonly Shape[] = [
  {
    slug: 'boletus-edulis',
    name: 'Steinpilz',
    latin: 'Boletus edulis',
    edibility: 'edible',
    cap: ['#7a5230', '#c9a877'],
  },
  {
    slug: 'boletus-reticulatus',
    name: 'Sommersteinpilz',
    latin: 'Boletus reticulatus',
    edibility: 'edible',
    cap: ['#4a5a3a', '#8a9a5a'],
  },
  {
    slug: 'boletus-pinophilus',
    name: 'Kiefernsteinpilz',
    latin: 'Boletus pinophilus',
    edibility: 'edible',
    cap: ['#4a5a3a', '#8a9a5a'],
  },
];
