import {
  asPercent,
  shareMet,
  unitOf,
  formatNumber,
  histogramFor,
  readHistogram,
  layerGroups,
  layerFolders,
  layerWeek,
  findLayer,
  formatValue,
  readLayers,
  matchingWeek,
  joinNotes,
} from './layers';

const RAW = {
  bounds: [
    [47.14, 4.93],
    [55.25, 15.14],
  ],
  layers: {
    regen_4w: {
      label: 'Niederschlag der letzten 4 Wochen',
      unit: 'mm',
      static: false,
      low: 0,
      high: 151.9,
      weeks: ['2025W39', '2025W40'],
      tiles: 'layers_kacheln/regen_4w',
      zooms: [5, 7],
      have: { '7': ['66/42'] },
      histograms: {
        '2025W39': { classes: [0, 50, 151.9], shares: [0.5, 0.5] },
        '2025W40': { classes: [0, 50, 151.9], shares: [0.8, 0.2] },
        broken: { classes: [0, 1], shares: [] },
      },
    },
    wald: {
      label: 'Waldanteil',
      unit: '',
      static: true,
      low: 0,
      high: 1,
      tiles: 'layers_kacheln/wald',
      zooms: [5, 8],
      have: { '8': ['132/82'] },
      histogram: { classes: [0, 0.5, 1], shares: [0.7, 0.3] },
    },
    fichte: {
      label: 'Fichte',
      unit: '',
      static: true,
      low: 0,
      high: 1,
      tiles: 'layers_kacheln/fichte',
      zooms: [5, 14],
      haveZoom: 10,
      offlineZoomTo: 12,
      have: { '10': ['548/350'] },
    },
    broken: { label: 'Ohne Kacheln' },
  },
};

const MANIFEST = readLayers(RAW);
const RAIN = MANIFEST.layers[0];
const FOREST = MANIFEST.layers[1];

describe('Ebenen', () => {
  it('liest Grenzen, Spanne, Wochen und die vorhandenen Kacheln', () => {
    expect(MANIFEST.bounds).toEqual([
      [4.93, 47.14],
      [15.14, 55.25],
    ]);
    expect(RAIN).toEqual({
      id: 'regen_4w',
      label: 'Niederschlag der letzten 4 Wochen',
      title: 'Niederschlag der letzten 4 Wochen',
      note: '',
      range: '',
      unit: 'mm',
      fixed: false,
      low: 0,
      high: 151.9,
      tilePath: 'layers_kacheln/regen_4w',
      zoomFrom: 5,
      zoomTo: 7,
      haveZoom: 7,
      offlineZoomTo: 7,
      existing: new Set(['7/66/42']),
      weeks: ['2025W39', '2025W40'],
      histogram: null,
      histograms: new Map([
        ['2025W39', { classes: [0, 50, 151.9], shares: [0.5, 0.5] }],
        ['2025W40', { classes: [0, 50, 151.9], shares: [0.8, 0.2] }],
      ]),
    });
  });

  it('lässt eine Ebene ohne Kachelordner weg', () => {
    expect(MANIFEST.layers.map((layer) => layer.id)).toEqual(['regen_4w', 'wald', 'fichte']);
  });

  it('macht aus einem leeren Manifest eine leere Liste', () => {
    expect(readLayers(null).layers).toEqual([]);
  });

  it('teilt in Wochenebenen und feste', () => {
    const { perWeek, fixed } = layerGroups(MANIFEST.layers);

    expect(perWeek.map((layer) => layer.id)).toEqual(['regen_4w']);
    expect(fixed.map((layer) => layer.id)).toEqual(['wald', 'fichte']);
  });

  it('schreibt den Wochenschlüssel wie das Rendering', () => {
    expect(layerWeek(2026, 7)).toBe('2026W07');
  });

  it('nimmt die jüngste Woche, die die Ebene hat', () => {
    expect(matchingWeek(RAIN, '2025W40')).toBe('2025W40');
    expect(matchingWeek(RAIN, '2026W10')).toBe('2025W40');
    expect(matchingWeek(RAIN, '2024W01')).toBe('2025W39');
    expect(matchingWeek(RAIN, null)).toBe('2025W40');
    expect(matchingWeek(FOREST, '2025W40')).toBeNull();
  });

  it('baut den Kachelordner mit und ohne Woche', () => {
    expect(layerFolders(RAIN, '2025W39')).toBe('layers_kacheln/regen_4w/2025W39');
    expect(layerFolders(FOREST, '2025W39')).toBe('layers_kacheln/wald');
  });

  it('findet eine Ebene über ihre Kennung', () => {
    expect(findLayer(MANIFEST, 'wald')?.label).toBe('Waldanteil');
    expect(findLayer(MANIFEST, 'gibtesnicht')).toBeNull();
    expect(findLayer(null, 'wald')).toBeNull();
    expect(findLayer(MANIFEST, null)).toBeNull();
  });

  it('liest einen Anteil als Prozent, einen pH-Wert nicht', () => {
    const ph = readLayers({
      layers: {
        boden_ph: { label: 'Boden-pH', unit: '', static: true, low: 4.663, high: 6.899, tiles: 'x' },
      },
    }).layers[0];

    expect(asPercent(FOREST)).toBe(true);
    expect(asPercent(ph)).toBe(false);
    expect(formatValue(0.72, FOREST, 'de')).toBe('72 %');
    expect(formatValue(4.663, ph, 'de')).toBe('4,7');
  });

  it('nennt die Einheit und rundet grobe Zahlen', () => {
    expect(formatValue(0, RAIN, 'de')).toBe('0 mm');
    expect(formatValue(151.9, RAIN, 'de')).toBe('152 mm');
    expect(formatValue(12.34, RAIN, 'de')).toBe('12,3 mm');
    expect(formatValue(151.9, RAIN, 'en')).toBe('152 mm');
  });

  it('nimmt das Histogramm der Woche, bei einer festen Ebene das eine', () => {
    expect(histogramFor(RAIN, '2025W39')?.shares).toEqual([0.5, 0.5]);
    expect(histogramFor(RAIN, '2026W10')?.shares).toEqual([0.8, 0.2]);
    expect(histogramFor(FOREST, '2025W39')?.shares).toEqual([0.7, 0.3]);
    expect(histogramFor({ ...RAIN, histograms: new Map() }, '2025W39')).toBeNull();
  });

  it('lässt ein Histogramm weg, dessen Kanten nicht zu den Anteilen passen', () => {
    expect(readHistogram({ classes: [0, 1], shares: [] })).toBeNull();
    expect(readHistogram({ classes: [0, 1, 2], shares: [0.5] })).toBeNull();
    expect(readHistogram(null)).toBeNull();
    expect(readHistogram({ classes: [0, 1], shares: [1] })).toEqual({ classes: [0, 1], shares: [1] });
  });

  it('rechnet den Anteil der Fläche, der eine Bedingung erfüllt', () => {
    const distribution = { classes: [0, 10, 20, 30], shares: [0.5, 0.3, 0.2] };

    expect(shareMet(distribution, 0, 30)).toBeCloseTo(1);
    expect(shareMet(distribution, 10, 20)).toBeCloseTo(0.3);
    expect(shareMet(distribution, 20, 30)).toBeCloseTo(0.2);
    // Eine halb getroffene Klasse zählt halb: gleichmäßig ist die ehrlichste Annahme.
    expect(shareMet(distribution, 15, 20)).toBeCloseTo(0.15);
    expect(shareMet(distribution, 5, 25)).toBeCloseTo(0.25 + 0.3 + 0.1);
    expect(shareMet(distribution, 40, 50)).toBe(0);
    expect(shareMet(distribution, -10, 100)).toBeCloseTo(1);
  });

  it('nennt die Einheit, auch wo ein Anteil als Prozent gilt', () => {
    expect(unitOf(RAIN)).toBe('mm');
    expect(unitOf(FOREST)).toBe('%');
    expect(formatNumber(0.72, FOREST, 'de')).toBe('72');
  });
});

describe('Ebenen mit Kappe', () => {
  const SPRUCE = MANIFEST.layers[2];

  it('liest die Kappe der Kachelliste und die Stufe fürs Gebiet', () => {
    expect(SPRUCE.zoomTo).toBe(14);
    expect(SPRUCE.haveZoom).toBe(10);
    expect(SPRUCE.offlineZoomTo).toBe(12);
  });

  it('nimmt ohne Kappe die feinste Stufe', () => {
    expect(FOREST.haveZoom).toBe(8);
    expect(FOREST.offlineZoomTo).toBe(8);
  });
});

describe('Vermerke verbinden', () => {
  it('ohne Vermerk bleibt null', () => {
    expect(joinNotes([])).toBeNull();
    expect(joinNotes([''])).toBeNull();
  });

  it('ein Vermerk bleibt für sich', () => {
    expect(joinNotes(['Thünen-Institut, CC BY 4.0'])).toBe('Thünen-Institut, CC BY 4.0');
  });

  it('mehrere Vermerke verbinden sich mit „ · "', () => {
    expect(joinNotes(['Thünen-Institut, CC BY 4.0', 'Landesvermessung, DGM 25'])).toBe(
      'Thünen-Institut, CC BY 4.0 · Landesvermessung, DGM 25',
    );
  });

  it('doppelte Vermerke bleiben einmal stehen', () => {
    expect(joinNotes(['Thünen-Institut, CC BY 4.0', 'Thünen-Institut, CC BY 4.0'])).toBe(
      'Thünen-Institut, CC BY 4.0',
    );
  });
});
