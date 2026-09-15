/** Die Attrappen der Artseite. Die Werte stehen so in den Boards. */

import { PALETTE } from './species';

function term(slug: string, name: string, kind: string): Record<string, unknown> {
  return { id: `00000000-0000-4000-b000-${slug.padEnd(12, '0').slice(0, 12)}`, slug, name, kind };
}

function colour(name: string, hex: string): Record<string, unknown> {
  return { name, hex };
}

/** Der Steinpilz mit dem Profil, das die Boards zeichnen. */
export const STONE_PROFILE: Record<string, unknown> = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  taxonId: null,
  genusName: 'Boletus',
  familyName: 'Boletaceae',
  group: 'bolete',
  edibility: 'edible',
  protection: 'none',
  forecastEnabled: true,
  leadPhotoId: '00000000-0000-4000-9000-000000000001',
  updatedAt: '2026-01-01T00:00:00Z',
  description: null,
  marketable: true,
  frequency: null,
  redList: null,
  edibilityNote: null,
  protectionNote: null,
  periodStartMonth: 6,
  periodEndMonth: 10,
  periodPeakMonth: null,
  smellText: 'Frisch angenehm pilzig, mit dem Alter etwas streng.',
  tasteText: 'Mild und nussig, roh nicht bitter.',
  hymeniumType: 'tubes',
  gillAttachment: null,
  gillSpacing: null,
  gillEdge: null,
  capShapeYoung: 'hemispherical',
  capShapeOld: 'convex',
  names: [],
  measurements: [
    {
      part: 'cap',
      measurements: [{ dimension: 'width', unit: 'cm', low: 4, high: 20, rareLow: null, rareHigh: 25 }],
    },
    {
      part: 'stem',
      measurements: [
        { dimension: 'height', unit: 'cm', low: 5, high: 15, rareLow: null, rareHigh: null },
        { dimension: 'thickness', unit: 'cm', low: 2, high: 6, rareLow: null, rareHigh: null },
      ],
    },
    {
      part: 'pores',
      measurements: [{ dimension: 'width', unit: 'mm', low: 0.3, high: 0.3, rareLow: null, rareHigh: null }],
    },
    {
      part: 'spore',
      measurements: [{ dimension: 'length', unit: 'um', low: 15, high: 19, rareLow: null, rareHigh: null }],
    },
  ],
  colours: [
    {
      part: 'cap',
      mode: 'gradient',
      colours: [colour('hell', '#e2c79a'), colour('dunkelbraun', '#6b4423')],
    },
    {
      part: 'tubes',
      mode: 'distinct',
      colours: [colour('weiß', '#f0ece0'), colour('später gelb', '#cfd08a')],
    },
    {
      part: 'stem',
      mode: 'gradient',
      colours: [colour('cremeweiß', '#f2e8d5'), colour('ocker', '#c9a877')],
    },
    { part: 'spore_print', mode: 'single', colours: [colour('olivbraun', '#7a5c2e')] },
  ],
  colourChanges: [
    {
      part: 'tubes',
      kind: 'mechanical',
      from: colour('gelb', '#cfd08a'),
      to: colour('blau', '#3f6ea8'),
      speed: 'immediate',
      triggers: [term('pressure', 'Druck', 'trigger')],
    },
    {
      part: 'flesh',
      kind: 'mechanical',
      from: colour('weiß', '#f4efe2'),
      to: colour('blau', '#5b7fb0'),
      speed: '1min',
      triggers: [term('cut', 'Schnitt', 'trigger')],
    },
    {
      part: 'flesh',
      kind: 'reagent',
      from: colour('weiß', '#f4efe2'),
      to: colour('orange', '#d9a441'),
      speed: 'immediate',
      triggers: [term('koh', 'KOH 3 %', 'trigger')],
    },
    {
      part: 'flesh',
      kind: 'reagent',
      from: colour('weiß', '#f4efe2'),
      to: colour('graugrün', '#7f8f6a'),
      speed: '30s',
      triggers: [term('iron', 'Eisensulfat', 'trigger')],
    },
    {
      part: 'stem_base',
      kind: 'mechanical',
      from: colour('weiß', '#f4efe2'),
      to: colour('rot', '#c94f3d'),
      speed: '3min',
      triggers: [term('cut', 'Schnitt', 'trigger')],
    },
  ],
  capFeatures: [],
  capMargins: [],
  stemFeatures: [],
  traits: [],
  sources: [
    {
      scope: 'profile',
      title: '123pilzsuche.de',
      url: 'https://123pilzsuche.de',
      checkedOn: '2026-09-01',
    },
    { scope: 'profile', title: 'Wikipedia', url: 'https://de.wikipedia.org', checkedOn: '2026-09-01' },
  ],
  seasons: [],
  terms: [
    { term: term('mushroomy', 'pilzig', 'smell'), fromExperience: false },
    { term: term('nutty-smell', 'nussig', 'smell'), fromExperience: false },
    { term: term('pleasant', 'angenehm', 'smell'), fromExperience: false },
    { term: term('mild', 'mild', 'taste'), fromExperience: false },
    { term: term('nutty', 'nussig', 'taste'), fromExperience: false },
  ],
  lookalikes: [
    {
      slug: 'tylopilus-felleus',
      name: 'Gallenröhrling',
      scientificName: 'Tylopilus felleus',
      edibility: 'inedible',
      capColours: [colour('hellbraun', '#d8b98a'), colour('ocker', '#8a6a3a')],
      difference: null,
    },
    {
      slug: 'imleria-badia',
      name: 'Maronenröhrling',
      scientificName: 'Imleria badia',
      edibility: 'edible',
      capColours: [colour('dunkelbraun', '#5a3418'), colour('kastanie', '#8a4e2b')],
      difference: null,
    },
    {
      slug: 'boletus-reticulatus',
      name: 'Sommersteinpilz',
      scientificName: 'Boletus reticulatus',
      edibility: 'edible',
      capColours: [colour('hell', '#e2c79a'), colour('braun', '#b88a52')],
      difference: null,
    },
  ],
};

/** Die drei Verwechslungen als eigene Arten, jede mit Titelbild. */
const LOOKALIKE_SPECIES = ['tylopilus-felleus', 'imleria-badia', 'boletus-reticulatus'].map((slug, at) => ({
  ...STONE_PROFILE,
  id: `00000000-0000-4000-8000-00000000000${String(at + 2)}`,
  slug,
  name: slug,
  leadPhotoId: `la-${String(at + 1)}`,
  lookalikes: [],
  sources: [],
}));

/** Eine Art, die nur ihre Verwechslungen trägt: der Einstieg in den Vergleich. */
const LOOKALIKES_ONLY: Record<string, unknown> = {
  ...STONE_PROFILE,
  measurements: [],
  colours: [],
  colourChanges: [],
  terms: [],
  smellText: null,
  tasteText: null,
  hymeniumType: null,
  periodStartMonth: null,
  periodEndMonth: null,
  sources: [],
  forecastEnabled: false,
  leadPhotoId: null,
};

/** Das Bündel des Bretts `CompareEntry`: nur Verwechslungen, kein anderes Merkmal. */
export function lookalikesBundle(): Record<string, unknown> {
  return { items: [LOOKALIKES_ONLY, ...LOOKALIKE_SPECIES], standardColours: PALETTE, facets: {} };
}

/** Das Bündel der Artseite: die Art mit vollem Profil und ihre Verwechslungen. */
export function profileBundle(): Record<string, unknown> {
  return { items: [STONE_PROFILE, ...LOOKALIKE_SPECIES], standardColours: PALETTE, facets: {} };
}

/** Die vier freigegebenen Bilder der Artseite. */
export function profilePhotos(): Record<string, unknown> {
  const items = ['eins', 'zwei', 'drei', 'vier'].map((id, at) => ({
    id,
    ownerId: '00000000-0000-4000-a000-000000000001',
    speciesId: STONE_PROFILE['id'],
    findId: null,
    width: 1600,
    height: 1200,
    photographer: 'Frederik Beimgraben',
    ownerName: 'Frederik',
    licence: 'cc_by_sa_4',
    caption: null,
    source: null,
    takenOn: '2026-09-06',
    lat: null,
    lon: null,
    lead: at === 0,
    state: 'approved',
    rejectReason: null,
    reviewedById: null,
    reviewedAt: null,
    createdAt: '2026-09-09T08:00:00+02:00',
    updatedAt: '2026-09-09T08:00:00+02:00',
  }));
  return { items, nextCursor: null };
}

/** Die Glocke der Saison, wie die Werkstatt sie zeichnet. */
function bell(week: number, peak: number, offset: number, factor: number): number {
  const position = week - peak - offset;
  return (
    factor *
    (Math.exp(-(position * position) / 26) + 0.25 * Math.exp(-((position + 6) * (position + 6)) / 40))
  );
}

/** Das Manifest der Karte: 2024 als Fläche, 2025 als Linie bis KW 39. */
export function profileManifest(): Record<string, unknown> {
  const week = (year: number, number_: number, mean: number): Record<string, unknown> => ({
    year,
    week: number_,
    forecast: false,
    tiles: `${String(year)}-${String(number_).padStart(2, '0')}`,
    mean,
    max: mean,
  });
  const past = Array.from({ length: 52 }, (_, at) => week(2024, at + 1, bell(at + 1, 40, 0, 1)));
  const current = Array.from({ length: 39 }, (_, at) => week(2025, at + 1, bell(at + 1, 40, -1.5, 1.1)));
  return {
    species: ['Boletus edulis'],
    top: 0.32,
    bounds: [
      [47.2, 5.8],
      [55.1, 15.1],
    ],
    tiles: { zooms: [5, 8], have: {} },
    weeks: [...past, ...current],
  };
}
