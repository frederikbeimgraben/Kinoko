/** Die Daten der einzelnen Bretter der Seite Arten. */

import { bundle } from './species';

type Entry = Parameters<typeof bundle>[0][number];

/** Der Baumpartner, den das Brett `FilterResult` als Marke zeigt. */
const SPRUCE = { slug: 'picea-abies', name: 'Fichte', kind: 'tree' };

/** Die Treffer des Bretts `FilterResult`. */
export const RESULT_HITS: readonly Entry[] = [
  {
    slug: 'boletus-edulis',
    name: 'Steinpilz',
    latin: 'Boletus edulis',
    edibility: 'edible',
    cap: ['#e2c79a', '#6b4423'],
    capShapes: ['convex'],
    capWidth: [5, 10],
    terms: [SPRUCE],
  },
  {
    slug: 'imleria-badia',
    name: 'Maronenröhrling',
    latin: 'Imleria badia',
    edibility: 'edible',
    cap: ['#8a4e2b', '#4a3220'],
    capShapes: ['convex'],
    capWidth: [5, 10],
    terms: [SPRUCE],
  },
  {
    slug: 'amanita-rubescens',
    name: 'Perlpilz',
    latin: 'Amanita rubescens',
    edibility: 'edible',
    cap: ['#c9a877', '#8a4e2b'],
    capShapes: ['convex'],
    capWidth: [5, 10],
    terms: [SPRUCE],
  },
];

/** Die Arten ohne Angabe zur Hutform im Brett `FilterResult`. */
export const RESULT_UNKNOWN: readonly Entry[] = [
  {
    slug: 'armillaria-mellea',
    name: 'Hallimasch',
    latin: 'Armillaria mellea',
    edibility: 'edible',
    cap: ['#c9a877', '#8a6a3a'],
    capWidth: [5, 10],
  },
  {
    slug: 'coprinus-comatus',
    name: 'Schopftintling',
    latin: 'Coprinus comatus',
    edibility: 'edible',
    cap: ['#f2e8d5', '#c9a877'],
    capWidth: [5, 10],
  },
];

/** Die Arten der linken Spalte im Brett `SpeciesDesktop`. */
export const DESKTOP_SPECIES: readonly Entry[] = [
  {
    slug: 'boletus-edulis',
    name: 'Steinpilz',
    latin: 'Boletus edulis',
    edibility: 'edible',
    group: 'bolete',
    cap: ['#7a5230', '#c9a877'],
    capWidth: [4, 20],
    stemHeight: [5, 15],
    stemThickness: [2, 6],
    months: [6, 10],
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
    slug: 'amanita-rubescens',
    name: 'Perlpilz',
    latin: 'Amanita rubescens',
    edibility: 'edible',
    cap: ['#4a5a3a', '#8a9a5a'],
  },
  {
    slug: 'amanita-phalloides',
    name: 'Grüner Knollenblätterpilz',
    latin: 'Amanita phalloides',
    edibility: 'deadly',
    cap: ['#4a5a3a', '#8a9a5a'],
  },
];

const DESKTOP_HITS: readonly Entry[] = [
  {
    slug: 'agaricus-campestris',
    name: 'Wiesenchampignon',
    latin: 'Agaricus campestris',
    edibility: 'edible',
    cap: ['#f2e8d5', '#c9a877'],
    hymenium: 'gills',
    months: [8, 10],
  },
  {
    slug: 'imleria-badia',
    name: 'Maronenröhrling',
    latin: 'Imleria badia',
    edibility: 'edible',
    cap: ['#8a4e2b', '#4a3220'],
    hymenium: 'gills',
    months: [8, 10],
  },
  {
    slug: 'amanita-rubescens',
    name: 'Perlpilz',
    latin: 'Amanita rubescens',
    edibility: 'edible',
    cap: ['#c9a877', '#8a4e2b'],
    hymenium: 'gills',
    months: [8, 10],
  },
  {
    slug: 'cantharellus-cibarius',
    name: 'Pfifferling',
    latin: 'Cantharellus cibarius',
    edibility: 'edible',
    cap: ['#d9a441', '#e8c86a'],
    hymenium: 'gills',
    months: [8, 10],
  },
];

// Der Rest trägt eine andere Fruchtschicht und scheidet darum aus.
const DESKTOP_REST: readonly Entry[] = [
  {
    slug: 'boletus-edulis',
    name: 'Steinpilz',
    latin: 'Boletus edulis',
    edibility: 'edible',
    cap: ['#7a5230', '#c9a877'],
    hymenium: 'tubes',
    months: [8, 10],
  },
  {
    slug: 'hydnum-repandum',
    name: 'Semmelstoppelpilz',
    latin: 'Hydnum repandum',
    edibility: 'edible',
    cap: ['#e2c79a', '#c9a877'],
    hymenium: 'spines',
    months: [8, 10],
  },
];

/** Der Rest des Katalogs im Brett `FilterResult`: keine Art trifft. */
export const RESULT_REST: readonly Entry[] = Array.from({ length: 301 }, (_, at) => ({
  slug: `art-${String(at)}`,
  name: `Art ${String(at)}`,
  latin: `Genus specimen${String(at)}`,
  edibility: 'inedible',
  capShapes: ['flat'],
  capWidth: [5, 10] as const,
}));

/** Katalog und Wahl des Bretts `FilterDesktop`. */
export const FILTER_DESKTOP = {
  catalogue: [...DESKTOP_HITS, ...DESKTOP_REST],
  choice: {
    values: { edibility: ['edible'], hymenium: ['gills'], period: ['9'] },
    colours: { gills: '#f3efe6', flesh: '#f3efe6', spore_print: '#3e2a17' },
    sizes: {},
    keepUnknown: ['colour'],
  },
};

/** Arten außerhalb ihrer Wachstumszeit: sie zählen mit, treffen aber nie. */
function fillerOf(edibility: string, count: number, from: number): Entry[] {
  return Array.from({ length: count }, (_, at) => ({
    slug: `filler-${edibility}-${String(from + at)}`,
    name: `Art ${String(from + at)}`,
    latin: `Genus specimen${String(from + at)}`,
    edibility,
    hymenium: 'tubes',
    months: [1, 3] as const,
  }));
}

/** Katalog des Bretts `FilterDesktopGroup`: dieselben Zahlen wie `FilterEdibility`. */
export const FILTER_DESKTOP_GROUP = {
  catalogue: [
    ...DESKTOP_HITS,
    ...DESKTOP_REST,
    ...fillerOf('edible', 71, 0),
    ...fillerOf('conditionally_edible', 5, 71),
    ...fillerOf('inedible', 142, 76),
    ...fillerOf('poisonous', 68, 218),
    ...fillerOf('deadly', 14, 286),
  ],
  choice: FILTER_DESKTOP.choice,
};

const TAXON_SPECIES: readonly Entry[] = [
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
    slug: 'xerocomellus-chrysenteron',
    name: 'Rotfußröhrling',
    latin: 'Xerocomellus chrysenteron',
    edibility: 'edible',
    cap: ['#8a6a3a', '#c98a4a'],
  },
];

function step(rank: string, slug: string, name: string): Record<string, unknown> {
  return { id: `00000000-0000-4000-a000-${slug.slice(0, 12).padEnd(12, '0')}`, slug, name, rank };
}

function summary(entry: Entry, at: number): Record<string, unknown> {
  return {
    id: `00000000-0000-4000-b000-${String(at).padStart(12, '0')}`,
    slug: entry.slug,
    name: entry.name,
    scientificName: entry.latin,
    taxonId: null,
    group: 'bolete',
    edibility: entry.edibility,
    protection: 'none',
    forecastEnabled: false,
    leadPhotoId: null,
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

/** Katalog und Stufe des Bretts `Taxonomy`. */
export const TAXON = {
  catalogue: TAXON_SPECIES,
  page: {
    ...step('family', 'boletaceae', 'Boletaceae'),
    description: null,
    path: [
      step('division', 'basidiomycota', 'Basidiomycota'),
      step('class', 'agaricomycetes', 'Agaricomycetes'),
      step('order', 'boletales', 'Boletales'),
    ],
    siblings: [],
    children: [
      { ...step('genus', 'boletus', 'Boletus'), speciesCount: 3 },
      { ...step('genus', 'imleria', 'Imleria'), speciesCount: 1 },
      { ...step('genus', 'xerocomellus', 'Xerocomellus'), speciesCount: 2 },
    ],
    species: TAXON_SPECIES.map(summary),
    speciesCount: 6,
  },
};
