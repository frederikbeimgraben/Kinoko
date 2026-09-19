/** Die Attrappen der Artenverwaltung im Bearbeiten-Modus. */

const NOW = '2026-09-10T10:00:00+02:00';

function colour(name: string, hex: string): Record<string, unknown> {
  return { name, hex };
}

/** Das Profil des Bretts `SpeciesEdit`. */
export const STONE_EDIT: Record<string, unknown> = {
  id: '00000000-0000-4000-8000-000000000000',
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  taxonId: null,
  genusName: 'Boletus',
  familyName: null,
  group: 'bolete',
  edibility: 'edible',
  protection: 'none',
  forecastEnabled: true,
  leadPhotoId: null,
  updatedAt: NOW,
  updatedByName: 'Frederik',
  description: 'Brauner Hut, dicker Stiel mit weißem Netz',
  marketable: false,
  edibilityNote: 'Geschmacksprobe gegen den Gallenröhrling',
  hymeniumType: 'tubes',
  capShapeYoung: null,
  capShapeOld: null,
  periodStartMonth: null,
  periodEndMonth: null,
  periodPeakMonth: null,
  names: [],
  measurements: [
    {
      part: 'cap',
      measurements: [{ dimension: 'width', unit: 'cm', low: 4, high: 20, rareLow: null, rareHigh: null }],
    },
  ],
  colours: [
    {
      part: 'cap',
      mode: 'gradient',
      colours: [colour('hellbraun', '#b08a5a'), colour('dunkelbraun', '#5a3d22')],
    },
    { part: 'tubes', mode: 'single', colours: [colour('jung weiß', '#f4efe2')] },
    {
      part: 'tubes',
      mode: 'gradient',
      colours: [colour('später gelb', '#d9c04a'), colour('oliv', '#6f7a3a')],
    },
  ],
  colourChanges: [],
  capFeatures: [],
  capMargins: [],
  stemFeatures: [],
  traits: [],
  sources: [
    { scope: 'profile', title: '123pilzsuche.de', url: 'https://123pilzsuche.de', checkedOn: '2026-09-10' },
  ],
  seasons: [],
  terms: [],
  lookalikes: [
    {
      slug: 'tylopilus-felleus',
      name: 'Gallenröhrling',
      scientificName: 'Tylopilus felleus',
      edibility: 'inedible',
      capColours: [],
      difference: 'Röhren rosa, Netz grob, bitter',
    },
    {
      slug: 'imleria-badia',
      name: 'Maronenröhrling',
      scientificName: 'Imleria badia',
      edibility: 'edible',
      capColours: [],
      difference: 'Röhren blauen, Stiel ohne Netz',
    },
  ],
};

/** Die Zahlen des Bretts `SpeciesEdit`. */
export const STONE_EDIT_COUNTS = { records: 1284, finds: 12, photos: 3 };
