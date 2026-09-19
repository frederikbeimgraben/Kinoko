/** Die Attrappe der Bretter `Compare` und `CompareDesktop`. */

import { PALETTE } from './species';

interface Tone {
  name: string;
  hex: string;
}

interface Change {
  from: Tone;
  to: Tone;
  speed: string;
}

interface Shape {
  slug: string;
  name: string;
  latin: string;
  edibility: string;
  cap: readonly Tone[];
  tubes: readonly Tone[];
  capWidth: readonly [number, number];
  months: readonly [number, number];
  flavours: readonly string[];
  change?: Change;
  stem?: string;
  lookalikes?: readonly Shape[];
}

const WHITE = { name: 'weiss', hex: '#f0ece0' };
const OLIVE = { name: 'oliv', hex: '#cfd08a' };
const PINK = { name: 'rosa', hex: '#e8c8cf' };
const DARK_PINK = { name: 'dunkelrosa', hex: '#d9a0ac' };
const BLUE = { name: 'blau', hex: '#3f6ea8' };

function identifier(prefix: string, at: number): string {
  return `00000000-0000-4000-${prefix}-${String(at).padStart(12, '0')}`;
}

function term(name: string, at: number): Record<string, unknown> {
  return {
    term: { id: identifier('c000', at), slug: name, name, kind: 'taste' },
    fromExperience: false,
  };
}

function lookalike(entry: Shape): Record<string, unknown> {
  return {
    slug: entry.slug,
    name: entry.name,
    scientificName: entry.latin,
    edibility: entry.edibility,
    capColours: entry.cap,
    difference: null,
  };
}

/** Eine Art in der Form des Vertrags, mit allem, was der Vergleich liest. */
export function species(entry: Shape, at: number): Record<string, unknown> {
  return {
    id: identifier('8000', at),
    slug: entry.slug,
    name: entry.name,
    scientificName: entry.latin,
    taxonId: null,
    genusName: entry.latin.split(' ')[0],
    familyName: null,
    group: 'bolete',
    edibility: entry.edibility,
    protection: 'none',
    forecastEnabled: false,
    leadPhotoId: null,
    updatedAt: '2026-01-01T00:00:00Z',
    description: null,
    marketable: false,
    hymeniumType: 'tubes',
    capShapeYoung: null,
    capShapeOld: null,
    periodStartMonth: entry.months[0],
    periodEndMonth: entry.months[1],
    periodPeakMonth: null,
    names: [],
    measurements: [
      {
        part: 'cap',
        measurements: [
          {
            dimension: 'width',
            unit: 'cm',
            low: entry.capWidth[0],
            high: entry.capWidth[1],
          },
        ],
      },
    ],
    colours: [
      { part: 'cap', mode: 'gradient', colours: entry.cap },
      { part: 'tubes', mode: entry.tubes.length > 1 ? 'distinct' : 'single', colours: entry.tubes },
    ],
    colourChanges: entry.change
      ? [
          {
            part: 'tubes',
            kind: 'mechanical',
            from: entry.change.from,
            to: entry.change.to,
            speed: entry.change.speed,
            triggers: [],
          },
        ]
      : [],
    capFeatures: [],
    capMargins: [],
    stemFeatures: [],
    traits: entry.stem === undefined ? [] : [{ key: 'stem', text: entry.stem }],
    sources: [],
    seasons: [],
    terms: entry.flavours.map((taste, index) => term(taste, at * 10 + index)),
    lookalikes: (entry.lookalikes ?? []).map((one) => lookalike(one)),
  };
}

const GALL: Shape = {
  slug: 'tylopilus-felleus',
  name: 'Gallenröhrling',
  latin: 'Tylopilus felleus',
  edibility: 'inedible',
  cap: [
    { name: 'hellbraun', hex: '#d8b98a' },
    { name: 'mittelbraun', hex: '#8a6a3a' },
  ],
  tubes: [PINK],
  capWidth: [4, 12],
  months: [5, 11],
  flavours: ['bitter'],
  change: { from: PINK, to: DARK_PINK, speed: '1min' },
};

const BAY: Shape = {
  slug: 'imleria-badia',
  name: 'Maronenröhrling',
  latin: 'Imleria badia',
  edibility: 'edible',
  cap: [
    { name: 'kastanie', hex: '#8a4e2b' },
    { name: 'dunkelbraun', hex: '#4a3220' },
  ],
  tubes: [OLIVE],
  capWidth: [3, 10],
  months: [6, 11],
  flavours: ['mild'],
  change: { from: OLIVE, to: BLUE, speed: 'immediate' },
};

const SUMMER: Shape = {
  slug: 'boletus-reticulatus',
  name: 'Sommersteinpilz',
  latin: 'Boletus reticulatus',
  edibility: 'edible',
  cap: [
    { name: 'sand', hex: '#e2c79a' },
    { name: 'kastanie', hex: '#8a4e2b' },
  ],
  tubes: [WHITE],
  capWidth: [5, 20],
  months: [5, 10],
  flavours: ['mild'],
};

const STONE: Shape = {
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  latin: 'Boletus edulis',
  edibility: 'edible',
  cap: [
    { name: 'sand', hex: '#e2c79a' },
    { name: 'braun', hex: '#6b4423' },
  ],
  tubes: [WHITE, OLIVE],
  capWidth: [4, 20],
  months: [5, 11],
  flavours: ['mild', 'nussig'],
  lookalikes: [GALL, BAY, SUMMER],
};

/** Ein Bündel ohne gezählte Achsen: der Vergleich liest keine. */
function bundleOf(entries: readonly Shape[]): Record<string, unknown> {
  return {
    items: entries.map((entry, at) => species(entry, at)),
    standardColours: PALETTE,
    facets: {},
  };
}

/** Beide Bretter: zwei Arten im Vergleich, beide mit einem Merkmal am Stiel. */
export const COMPARE = bundleOf([
  { ...STONE, stem: 'weiß, fein' },
  { ...GALL, stem: 'dunkelbraun, grob' },
  BAY,
  SUMMER,
]);
