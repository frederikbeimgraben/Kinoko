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
  family?: string;
  terms?: readonly Term[];
}

interface Term {
  slug: string;
  name: string;
  kind: string;
}

function termEntry(term: Term, at: number): Record<string, unknown> {
  return {
    term: {
      id: `00000000-0000-4000-c000-${String(at).padStart(12, '0')}`,
      slug: term.slug,
      name: term.name,
      kind: term.kind,
    },
    fromExperience: false,
  };
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
    genusName: entry.latin.split(' ')[0],
    familyName: entry.family ?? null,
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
    terms: (entry.terms ?? []).map((term, index) => termEntry(term, at * 10 + index)),
    lookalikes: [],
  };
}

/** Die zwölf Standardfarben, wie sie der Dienst liefert. */
export const PALETTE: readonly { key: string; hex: string }[] = [
  { key: 'white', hex: '#f3efe6' },
  { key: 'cream', hex: '#e8d9b5' },
  { key: 'yellow', hex: '#e0b446' },
  { key: 'orange', hex: '#d1832f' },
  { key: 'redBrown', hex: '#a0522d' },
  { key: 'brown', hex: '#6b4423' },
  { key: 'darkBrown', hex: '#3e2a17' },
  { key: 'olive', hex: '#7f8a3a' },
  { key: 'green', hex: '#4f7a3a' },
  { key: 'red', hex: '#b8322a' },
  { key: 'violet', hex: '#7a3b6a' },
  { key: 'grey', hex: '#8a8f8a' },
];

/** Ein Bündel aus einer Liste von Arten, mit Palette und gezählten Achsen. */
export function bundle(entries: readonly Shape[]): Record<string, unknown> {
  const items = entries.map((entry, at) => species(entry, at));
  return { items, standardColours: PALETTE, facets: countAxes(entries) };
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

const GAMMA_CUT = 0.04045;
const WEIGHTS: readonly [number, number, number] = [1, 2, 2];

function oklab(value: string): [number, number, number] {
  const raw = value.replace('#', '');
  const [red, green, blue] = [0, 2, 4]
    .map((at) => parseInt(raw.slice(at, at + 2), 16) / 255)
    .map((one) => (one <= GAMMA_CUT ? one / 12.92 : ((one + 0.055) / 1.055) ** 2.4));
  const long = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const medium = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const short = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;
  const [one, two, three] = [long, medium, short].map((part) => part ** (1 / 3));
  return [
    0.2104542553 * one + 0.793617785 * two - 0.0040720468 * three,
    1.9779984951 * one - 2.428592205 * two + 0.4505937099 * three,
    0.0259040371 * one + 0.7827717662 * two - 0.808675766 * three,
  ];
}

/** Die nächste Standardfarbe, wie der Dienst sie rechnet. */
export function nearestKey(hex: string): string {
  const target = oklab(hex);
  let best = PALETTE[0];
  let shortest = Number.POSITIVE_INFINITY;
  for (const colour of PALETTE) {
    const other = oklab(colour.hex);
    const span = Math.sqrt(
      target.reduce((sum, part, at) => sum + ((part - other[at]) * WEIGHTS[at]) ** 2, 0),
    );
    if (span < shortest) {
      shortest = span;
      best = colour;
    }
  }
  return best.key;
}

function monthsOf(entry: Shape): string[] {
  if (entry.months === undefined) return [];
  const [from, to] = entry.months;
  const inside = (month: number) =>
    from <= to ? month >= from && month <= to : month >= from || month <= to;
  return Array.from({ length: 12 }, (_, at) => at + 1)
    .filter(inside)
    .map(String);
}

function isSense(term: Term): boolean {
  return term.kind === 'smell' || term.kind === 'taste';
}

function axesOf(entry: Shape): Record<string, string[]> {
  const genus = entry.latin.split(' ')[0];
  return {
    edibility: [entry.edibility],
    hymenium: entry.hymenium ? [entry.hymenium] : [],
    capShape: [...new Set(entry.capShapes ?? [])],
    protection: [entry.protection ?? 'none'],
    forecast: entry.forecast ? ['on'] : [],
    period: monthsOf(entry),
    senses: (entry.terms ?? []).filter(isSense).map((term) => term.slug),
    treePartner: (entry.terms ?? []).filter((term) => term.kind === 'tree').map((term) => term.slug),
    genusFamily: [genus],
  };
}

/** Zählt die Achsen des Katalogs, wie der Dienst sie liefert. */
export function countAxes(entries: readonly Shape[]): Record<string, Record<string, number>> {
  const counts: Record<string, Record<string, number>> = {};
  const add = (axis: string, value: string) => {
    counts[axis] = counts[axis] ?? {};
    counts[axis][value] = (counts[axis][value] ?? 0) + 1;
  };
  for (const entry of entries) {
    for (const [axis, values] of Object.entries(axesOf(entry))) {
      if (values.length > 0) for (const value of values) add(axis, value);
      else if (axis !== 'forecast') add('unknown', axis);
    }
    for (const [part, hexes] of Object.entries({
      cap: entry.cap,
      stem: entry.stem,
      gills: entry.gills,
      flesh: entry.flesh,
      spore_print: entry.sporePrint,
    })) {
      for (const key of new Set((hexes ?? []).map(nearestKey))) add(`colour.${part}`, key);
    }
  }
  return counts;
}
