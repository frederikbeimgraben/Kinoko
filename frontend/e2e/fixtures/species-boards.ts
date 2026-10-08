/** The data of the single boards of the species tab. */

import { bundle } from './species';

type Entry = Parameters<typeof bundle>[0][number];

/** The four edible hits of the board `SpeciesFiltered`, per `SpeciesList.dc.html` with the filter `edible`. */
export const EDIBLE_HITS: readonly Entry[] = [
  {
    slug: 'imleria-badia',
    name: 'Maronenröhrling',
    latin: 'Imleria badia',
    edibility: 'edible',
    cap: ['#5a3220'],
  },
  {
    slug: 'amanita-rubescens',
    name: 'Perlpilz',
    latin: 'Amanita rubescens',
    edibility: 'edible',
    cap: ['#b97f72'],
    photo: false,
  },
  {
    slug: 'cantharellus-cibarius',
    name: 'Pfifferling',
    latin: 'Cantharellus cibarius',
    edibility: 'edible',
    cap: ['#b9832a'],
    photo: false,
  },
  {
    slug: 'agaricus-campestris',
    name: 'Wiesenchampignon',
    latin: 'Agaricus campestris',
    edibility: 'edible',
    cap: ['#e6e0cf'],
    photo: false,
  },
];

/** The species of the left column in the board `SpeciesDesktop`. */
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

// The rest has another hymenium, so it does not match.
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

/** The rest of the catalogue in the board `SpeciesFiltered`: no species matches. */
export const RESULT_REST: readonly Entry[] = Array.from({ length: 301 }, (_, at) => ({
  slug: `art-${String(at)}`,
  name: `Art ${String(at)}`,
  latin: `Genus specimen${String(at)}`,
  edibility: 'inedible',
  capShapes: ['flat'],
  capWidth: [5, 10] as const,
}));

/** The catalogue and the choice of the board `FilterDesktop`. */
export const FILTER_DESKTOP = {
  catalogue: [...DESKTOP_HITS, ...DESKTOP_REST],
  choice: {
    values: { edibility: ['edible'], hymenium: ['gills'], period: ['9'] },
    colours: { gills: '#f3efe6', flesh: '#f3efe6', spore_print: '#3e2a17' },
    sizes: {},
    keepUnknown: ['colour'],
  },
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
    leadPhotoId: `00000000-0000-4000-9000-${String(at).padStart(12, '0')}`,
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

/** The catalogue and the step of the board `Taxonomy`. */
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
