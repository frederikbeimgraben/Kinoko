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
      triggers: [term('pressure', 'Druck', 'trigger'), term('cut', 'Anschnitt', 'trigger')],
    },
  ],
  capFeatures: [],
  capMargins: [],
  stemFeatures: [],
  traits: [],
  sources: [],
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

/** Das Bündel der Artseite: eine Art mit vollem Profil. */
export function profileBundle(): Record<string, unknown> {
  return { items: [STONE_PROFILE], standardColours: PALETTE, facets: {} };
}
