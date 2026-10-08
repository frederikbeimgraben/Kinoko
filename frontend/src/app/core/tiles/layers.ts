/** The manifest of the input layers, as `modell/src/pilze/input_layers.py` writes it. */

import { decimal } from '../i18n/numbers';

/** The distribution of a source over Germany. The pipeline calculates it in advance. */
export interface Histogram {
  classes: readonly number[];
  shares: readonly number[];
}

/** An input layer, for example forest, soil pH or rain of the last four weeks. */
export interface Layer {
  id: string;
  /** The short name for header and list, for example „Niederschlag 4 Wochen“. */
  label: string;
  /** The full name for the layer field. */
  title: string;
  /** Source and grid, as the pipeline names them, for example „5-km-Raster, DWD HYRAS“. */
  note: string;
  /** The time range of the layer, as finished text from the pipeline. */
  range: string;
  /** `mm`, `Grad`, `m`, or empty for a share. */
  unit: string;
  /** A fixed layer applies to all weeks. A weekly layer follows the timeline. */
  fixed: boolean;
  /** The values of byte 1 and byte 255, in the unit of the layer. */
  low: number;
  high: number;
  tilePath: string;
  zoomFrom: number;
  zoomTo: number;
  /** The coarsest zoom level whose tiles `existing` lists one by one. */
  haveZoom: number;
  /** The finest zoom level that an offline area keeps. */
  offlineZoomTo: number;
  existing: ReadonlySet<string>;
  /** Week keys in the form `YYYYWww`, in ascending order. */
  weeks: readonly string[];
  /** The distribution of a fixed layer. */
  histogram: Histogram | null;
  /** One distribution for each week of a weekly layer. */
  histograms: ReadonlyMap<string, Histogram>;
}

export interface LayersManifest {
  /** South-west and north-east corner as [lon, lat], as MapLibre expects. */
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
  // The pipeline writes [lat, lon]. MapLibre expects [lon, lat].
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

/** The key of a week in the layer manifest: `YYYYWww`. */
export function layerWeek(year: number, week: number): string {
  return `${year}W${String(week).padStart(2, '0')}`;
}

/** The tile folder of a layer for a week. */
export function layerFolders(layer: Layer, week: string | null): string | null {
  if (layer.fixed) return layer.tilePath;
  const selected = matchingWeek(layer, week);
  return selected === null ? null : `${layer.tilePath}/${selected}`;
}

/** The layer week that applies to the selected week. */
export function matchingWeek(layer: Layer, week: string | null): string | null {
  if (layer.weeks.length === 0) return null;
  if (week === null) return layer.weeks[layer.weeks.length - 1];
  // All keys have the same length, so a text comparison is sufficient.
  const matches = layer.weeks.filter((own) => own <= week);
  return matches.length > 0 ? matches[matches.length - 1] : layer.weeks[0];
}

/** Splits the layers into two groups, weekly layers first. */
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

/** A layer without a unit and with values from 0 to 1 is a share. */
export function asPercent(layer: Layer): boolean {
  return layer.unit === '' && layer.low >= 0 && layer.high <= 1;
}

/** A layer value without unit, in the UI language. */
export function formatNumber(value: number, layer: Layer, locale: string): string {
  if (asPercent(layer)) {
    return decimal(value * 100, locale, { maximumFractionDigits: 0 });
  }
  return decimal(value, locale, { maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 1 });
}

export function unitOf(layer: Layer): string {
  return asPercent(layer) ? '%' : layer.unit;
}

/** A layer value with its unit, in the UI language. */
export function formatValue(value: number, layer: Layer, locale: string): string {
  const unit = unitOf(layer);
  const number = formatNumber(value, layer, locale);
  return unit === '' ? number : `${number} ${unit}`;
}

/** The distribution that applies to a week. */
export function histogramFor(layer: Layer, week: string | null): Histogram | null {
  if (layer.fixed) return layer.histogram;
  const selected = matchingWeek(layer, week);
  return selected === null ? null : (layer.histograms.get(selected) ?? null);
}

/** Joins the notes without duplicates with " · ". Gives `null` without notes. */
export function joinNotes(notes: readonly string[]): string | null {
  const unique = [...new Set(notes.filter((note) => note !== ''))];
  return unique.length > 0 ? unique.join(' · ') : null;
}

/** The share of the area whose value is in the range. */
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
