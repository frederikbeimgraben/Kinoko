/** Die Woche, die jedes Karten-Board zeigt. */
export const WEEK = { year: 2025, week: 40 };

/** Die Art, die jedes Karten-Board zeigt. */
export const SPECIES = 'boletus-edulis';

const SHARES = [0.18, 0.26, 0.4, 0.48, 0.62, 0.7, 0.88, 1];

/** Die erste Woche der Leiste. Gewählt ist KW 40, sie steht in der Mitte. */
const FIRST_WEEK = 36;

/** Ab dieser Woche rechnet die Kette, sie misst nicht mehr. */
const FIRST_FORECAST = 41;

function weeks(): unknown[] {
  return SHARES.map((share, index) => {
    const week = FIRST_WEEK + index;
    return {
      year: 2025,
      week,
      forecast: week >= FIRST_FORECAST,
      tiles: `boletus_edulis_kacheln/2025W${week}`,
      mean: share,
      max: share,
    };
  });
}

/** Das Manifest der Art: acht Wochen um KW 40, Höchstwert 0,5. */
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

/** Die Verteilung aus dem Board `Faktor`: vierzig Klassen, ein Buckel links. */
const CURVE = [
  0.005354, 0.007244, 0.009528, 0.012283, 0.015591, 0.019213, 0.023228, 0.027402, 0.031654, 0.035827,
  0.039606, 0.042756, 0.045276, 0.04685, 0.047479, 0.047087, 0.045827, 0.043701, 0.041024, 0.037953, 0.034803,
  0.031732, 0.028898, 0.026535, 0.024646, 0.023228, 0.022205, 0.021496, 0.020787, 0.020157, 0.019291,
  0.018189, 0.016772, 0.015118, 0.013228, 0.01126, 0.009291, 0.007402, 0.005748, 0.004331,
];

function share(count: number): { classes: number[]; shares: number[] } {
  const classes = Array.from({ length: 41 }, (_, i) => (i * count) / 40);
  return { classes, shares: CURVE };
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
      range: 'KW 40',
      unit: 'mm',
      low: 0,
      high: 152,
      tiles: 'layers_kacheln/regen_4w',
      zooms: [5, 8],
      weeks: ['2025W40'],
      histograms: { '2025W40': share(240) },
    },
    regen: {
      label: 'Niederschlag',
      note: 'Summe KW 37 bis 40',
      range: 'KW 37 bis 40',
      unit: 'mm',
      low: 0,
      high: 240,
      tiles: 'layers_kacheln/regen',
      zooms: [5, 8],
      weeks: ['2025W40'],
      histograms: { '2025W40': share(240) },
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
      histograms: { '2025W40': share(30) },
    },
    bodenfeuchte: {
      label: 'Bodenfeuchte',
      note: 'KW 40',
      unit: '% nFK',
      low: 0,
      high: 1,
      tiles: 'layers_kacheln/bodenfeuchte',
      zooms: [5, 8],
      weeks: ['2025W40'],
      histograms: { '2025W40': share(1) },
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
      histograms: { '2025W40': share(7) },
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
      histograms: { '2025W40': share(7) },
    },
  },
};

/** `LAYERS_MANIFEST` mit der festen Ebene Fichte, nur für ihre eigenen Boards. */
export const FICHTE_LAYERS_MANIFEST = {
  bounds: LAYERS_MANIFEST.bounds,
  layers: {
    ...LAYERS_MANIFEST.layers,
    fichte: {
      label: 'Fichte',
      note: 'Thünen-Institut, CC BY 4.0',
      unit: '',
      static: true,
      low: 0,
      high: 1,
      tiles: 'layers_kacheln/fichte',
      zooms: [5, 14],
      histogram: share(1),
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
    leadPhotoId: `00000000-0000-4000-9000-${slug.length.toString().padStart(12, '0')}`,
    updatedAt: '2025-10-01T00:00:00Z',
    names: [],
    measurements: [],
    colours: [],
    colourChanges: [],
  };
}

/** Der Katalog vom Gerät: fünf Arten mit Vorhersage, wie in den Boards. */
export const SPECIES_BUNDLE = {
  items: [
    species('boletus-edulis', 'Steinpilz', 'Boletus edulis'),
    species('cantharellus-cibarius', 'Pfifferling', 'Cantharellus cibarius'),
    species('imleria-badia', 'Maronenröhrling', 'Imleria badia'),
    species('hydnum-repandum', 'Semmelstoppelpilz', 'Hydnum repandum'),
    species('morchella-esculenta', 'Speisemorchel', 'Morchella esculenta'),
  ],
};

function markers(count: number): { items: unknown[]; nextCursor: null } {
  const items = Array.from({ length: count }, (_, i) => ({
    id: `marker-${i}`,
    lon: 9 + i * 0.05,
    lat: 48.5 + i * 0.05,
    name: `marker ${i}`,
    colour: 'green',
    visibility: 'private',
    note: null,
    updatedAt: '2025-10-01T00:00:00Z',
    deleted: false,
  }));
  return { items, nextCursor: null };
}

/** Geteilte Funde des Vertrags, geblättert wie `/finds`. */
function finds(count: number): { items: unknown[]; nextCursor: null } {
  const items = Array.from({ length: count }, (_, i) => ({
    id: `find-${i}`,
    lon: 9 + i * 0.05,
    lat: 48.5 + i * 0.05,
    speciesId: 'boletus-edulis',
    foundOn: '2025-10-01',
    count: null,
    reviewState: 'accepted',
    visibility: 'shared',
    note: null,
    updatedAt: '2025-10-01T00:00:00Z',
    deleted: false,
  }));
  return { items, nextCursor: null };
}

/** Die Zahlen aus dem Board `KarteEbenen`: 12 geteilte Funde, 5 Marker, 2 Zonen. */
export const SHARED_FINDS = finds(12);
export const MARKERS = markers(5);
export const ZONES = {
  items: Array.from({ length: 2 }, (_, i) => ({
    id: `zone-${i}`,
    name: `Zone ${i}`,
    colour: 'green',
    visibility: 'private',
    note: null,
    areaHa: 42,
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [9, 48],
          [9.1, 48],
          [9.1, 48.1],
          [9, 48],
        ],
      ],
    },
    updatedAt: '2025-10-01T00:00:00Z',
    deleted: false,
  })),
  nextCursor: null,
};

/** Die gespeicherten Kombinationen aus dem Board `Combinations`. */
export const COMBINATIONS = {
  items: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Herbst Steinpilz',
      rule: 'intersection',
      factors: [
        { source: 'regen', condition: 'above', low: 80, high: null, active: true },
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
        { source: 'regen', condition: 'above', low: 60, high: null, active: true },
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
