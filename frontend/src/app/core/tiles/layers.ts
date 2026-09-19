/** Das Manifest der Eingabe-Ebenen, wie es `modell/src/pilze/input_layers.py` neben die … */

/** Die Verteilung einer Quelle über Deutschland, vorgerechnet von der Kette … */
export interface Histogram {
  classes: readonly number[];
  shares: readonly number[];
}

/** Eine Eingabe-Ebene: Wald, Boden-pH, Niederschlag der letzten vier Wochen. */
export interface Layer {
  id: string;
  /** Der kurze Name für Kopf und Liste: „Niederschlag 4 Wochen“. */
  label: string;
  /** Der ganze Name für das Feld der Ebene. */
  title: string;
  /** Herkunft und Raster, wie die Kette sie nennt: „5-km-Raster, DWD HYRAS“. */
  note: string;
  /** Der Zeitraum, den die Ebene misst, als fertiger Text der Kette. */
  range: string;
  /** `mm`, `Grad`, `m` oder leer für einen Anteil. */
  unit: string;
  /** Eine feste Ebene gilt für all Wochen; eine Wochenebene folgt der Zeitleiste. */
  fixed: boolean;
  /** Was Byte 1 und Byte 255 bedeuten, in der Einheit der Ebene. */
  low: number;
  high: number;
  /** Ordner der Kacheln. */
  tilePath: string;
  zoomFrom: number;
  zoomTo: number;
  /** Die gröbste Stufe, deren Kacheln `existing` einzeln nennt. */
  haveZoom: number;
  /** Die feinste Stufe, die ein Offline-Gebiet mitnimmt. */
  offlineZoomTo: number;
  existing: ReadonlySet<string>;
  /** Wochenschlüssel der Form `JJJJWWW`, aufsteigend. */
  weeks: readonly string[];
  /** Die Verteilung einer festen Ebene. */
  histogram: Histogram | null;
  /** Je Woche eine Verteilung, bei einer Wochenebene. */
  histograms: ReadonlyMap<string, Histogram>;
}

export interface LayersManifest {
  /** Südwest- und Nordostecke als [Länge, Breite], wie MapLibre sie erwartet. */
  bounds: readonly [readonly [number, number], readonly [number, number]];
  layers: readonly Layer[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function corner(value: unknown): readonly [number, number] {
  // Die Kette schreibt [Breite, Länge], MapLibre erwartet [Länge, Breite].
  const pair = Array.isArray(value) ? value : [];
  return [number(pair[1]), number(pair[0])];
}

function readExisting(raw: unknown): Set<string> {
  const set = new Set<string>();
  if (!isObject(raw)) return set;
  for (const [zoom, catalogue] of Object.entries(raw)) {
    if (!Array.isArray(catalogue)) continue;
    for (const xy of catalogue) if (typeof xy === 'string') set.add(`${zoom}/${xy}`);
  }
  return set;
}

export function readHistogram(raw: unknown): Histogram | null {
  if (!isObject(raw)) return null;
  const classes = Array.isArray(raw['classes']) ? raw['classes'] : [];
  const shares = Array.isArray(raw['shares']) ? raw['shares'] : [];
  if (classes.length !== shares.length + 1 || shares.length === 0) return null;
  return {
    classes: classes.map((value) => number(value)),
    shares: shares.map((value) => number(value)),
  };
}

function readHistograms(raw: unknown): Map<string, Histogram> {
  const all = new Map<string, Histogram>();
  if (!isObject(raw)) return all;
  for (const [week, value] of Object.entries(raw)) {
    const distribution = readHistogram(value);
    if (distribution) all.set(week, distribution);
  }
  return all;
}

function readLayer(id: string, raw: unknown): Layer | null {
  if (!isObject(raw) || typeof raw['tiles'] !== 'string') return null;
  const zooms = Array.isArray(raw['zooms']) ? raw['zooms'] : [];
  const weeks = Array.isArray(raw['weeks']) ? raw['weeks'] : [];
  return {
    id,
    label: typeof raw['label'] === 'string' ? raw['label'] : id,
    title: text(raw['title']) ?? text(raw['label']) ?? id,
    note: text(raw['note']) ?? '',
    range: text(raw['range']) ?? '',
    unit: typeof raw['unit'] === 'string' ? raw['unit'] : '',
    fixed: raw['static'] === true,
    low: number(raw['low']),
    high: number(raw['high'], 1),
    tilePath: raw['tiles'],
    zoomFrom: number(zooms[0], 5),
    zoomTo: number(zooms[1], 8),
    haveZoom: number(raw['haveZoom'], number(zooms[1], 8)),
    offlineZoomTo: number(raw['offlineZoomTo'], number(zooms[1], 8)),
    existing: readExisting(raw['have']),
    weeks: weeks.filter((week): week is string => typeof week === 'string'),
    histogram: readHistogram(raw['histogram']),
    histograms: readHistograms(raw['histograms']),
  };
}

/** Liest `layers.json`. */
export function readLayers(raw: unknown): LayersManifest {
  const data = isObject(raw) ? raw : {};
  const bounds = Array.isArray(data['bounds']) ? data['bounds'] : [];
  const layers = isObject(data['layers']) ? data['layers'] : {};
  return {
    bounds: [corner(bounds[0]), corner(bounds[1])],
    layers: Object.entries(layers)
      .map(([id, value]) => readLayer(id, value))
      .filter((layer): layer is Layer => layer !== null),
  };
}

/** Der Schlüssel einer Woche im Manifest der Ebenen: `JJJJWWW`. */
export function layerWeek(year: number, week: number): string {
  return `${year}W${String(week).padStart(2, '0')}`;
}

/** Der Kachelordner einer Ebene für eine Woche. */
export function layerFolders(layer: Layer, week: string | null): string | null {
  if (layer.fixed) return layer.tilePath;
  const selected = matchingWeek(layer, week);
  return selected === null ? null : `${layer.tilePath}/${selected}`;
}

/** Die Woche der Ebene, die für die gewählte Woche gilt. */
export function matchingWeek(layer: Layer, week: string | null): string | null {
  if (layer.weeks.length === 0) return null;
  if (week === null) return layer.weeks[layer.weeks.length - 1];
  // Die Schlüssel sind gleich lang, ein Vergleich als Text reicht.
  const matches = layer.weeks.filter((own) => own <= week);
  return matches.length > 0 ? matches[matches.length - 1] : layer.weeks[0];
}

/** Die Ebenen in zwei Gruppen, je Woche zuerst. */
export function layerGroups(layers: readonly Layer[]): {
  perWeek: readonly Layer[];
  fixed: readonly Layer[];
} {
  return {
    perWeek: layers.filter((layer) => !layer.fixed),
    fixed: layers.filter((layer) => layer.fixed),
  };
}

export function findLayer(manifest: LayersManifest | null, id: string | null): Layer | null {
  if (!manifest || id === null) return null;
  return manifest.layers.find((layer) => layer.id === id) ?? null;
}

/** Eine Ebene ohne Einheit, die zwischen 0 und 1 liegt, ist ein Anteil. */
export function asPercent(layer: Layer): boolean {
  return layer.unit === '' && layer.low >= 0 && layer.high <= 1;
}

/** Ein Wert der Ebene ohne Einheit, in der Sprache der Oberfläche. */
export function formatNumber(value: number, layer: Layer, locale: string): string {
  if (asPercent(layer)) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value * 100);
  }
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 1,
  }).format(value);
}

/** Die Einheit, in der die Ebene misst. */
export function unitOf(layer: Layer): string {
  return asPercent(layer) ? '%' : layer.unit;
}

/** Ein Wert der Ebene mit seiner Einheit, in der Sprache der Oberfläche. */
export function formatValue(value: number, layer: Layer, locale: string): string {
  const unit = unitOf(layer);
  const number = formatNumber(value, layer, locale);
  return unit === '' ? number : `${number} ${unit}`;
}

/** Die Verteilung, die für eine Woche gilt. */
export function histogramFor(layer: Layer, week: string | null): Histogram | null {
  if (layer.fixed) return layer.histogram;
  const selected = matchingWeek(layer, week);
  return selected === null ? null : (layer.histograms.get(selected) ?? null);
}

/** Der Anteil der Fläche, dessen Wert in der Spanne liegt. */
export function shareMet(histogram: Histogram, von: number, bis: number): number {
  let sum = 0;
  for (let cssClass = 0; cssClass < histogram.shares.length; cssClass++) {
    const bottom = histogram.classes[cssClass];
    const top = histogram.classes[cssClass + 1];
    const width = top - bottom;
    if (width <= 0) continue;
    const part = Math.min(top, bis) - Math.max(bottom, von);
    if (part <= 0) continue;
    sum += histogram.shares[cssClass] * Math.min(part / width, 1);
  }
  return Math.min(Math.max(sum, 0), 1);
}
