/** Das Manifest einer Vorhersage-Art, wie es `modell/src/pilze/region_map.py` neben die … */

import { readHistogram, type Histogram } from './layers';
import { tileKey } from './tile-paths';

export { tileKey };

/** Eine Woche der Art. */
export interface ManifestWeek {
  year: number;
  week: number;
  /** Eine Woche ohne gemessenes Wetter, aus der Vorhersage gerechnet. */
  forecast: boolean;
  /** Ordner der Kacheln dieser Woche, ohne führenden Schrägstrich. */
  tilePath: string;
  mean: number;
  max: number;
  /** Die Verteilung der Woche über Deutschland, null als kleinster Wert. */
  histogram: Histogram | null;
}

/** Eine Art mit Vorhersage: Kacheln, Wochen und der Höchstwert der Rampe. */
export interface SpeciesManifest {
  slug: string;
  /** Die wissenschaftlichen Namen, die in die Art eingehen. */
  species: readonly string[];
  /** Der Wert, den Byte 255 einer Kachel bedeutet. */
  top: number;
  /** Südwest- und Nordostecke als [Länge, Breite], wie MapLibre sie erwartet. */
  bounds: readonly [readonly [number, number], readonly [number, number]];
  zoomFrom: number;
  zoomTo: number;
  /** Die gröbste Stufe, deren Kacheln `existing` einzeln nennt. */
  haveZoom: number;
  /** Die feinste Stufe, die ein Offline-Gebiet mitnimmt. */
  offlineZoomTo: number;
  /** Alle Kacheln mit Daten, als `z/x/y`. */
  existing: ReadonlySet<string>;
  weeks: readonly ManifestWeek[];
}

/** Die Form einer Woche als Text: Jahr, Strich, Wochennummer. */
export function weekKey(week: { year: number; week: number }): string {
  return `${week.year}-${String(week.week).padStart(2, '0')}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function corner(value: unknown): readonly [number, number] {
  // Die Kette schreibt [Breite, Länge], MapLibre erwartet [Länge, Breite].
  const pair = Array.isArray(value) ? value : [];
  return [number(pair[1]), number(pair[0])];
}

function readWeek(raw: unknown): ManifestWeek | null {
  if (!isObject(raw) || typeof raw['tiles'] !== 'string') return null;
  return {
    year: number(raw['year']),
    week: number(raw['week']),
    forecast: raw['forecast'] === true,
    tilePath: raw['tiles'],
    mean: number(raw['mean']),
    max: number(raw['max']),
    histogram: readHistogram(raw['histogram']),
  };
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

/** Liest ein Manifest. */
export function readManifest(raw: unknown, slug: string): SpeciesManifest {
  const data = isObject(raw) ? raw : {};
  const tiles = isObject(data['tiles']) ? data['tiles'] : {};
  const zooms = Array.isArray(tiles['zooms']) ? tiles['zooms'] : [];
  const bounds = Array.isArray(data['bounds']) ? data['bounds'] : [];
  const species = Array.isArray(data['species']) ? data['species'] : [];
  const weeks = Array.isArray(data['weeks']) ? data['weeks'] : [];
  return {
    slug,
    species: species.filter((name): name is string => typeof name === 'string'),
    top: number(data['top'], 1),
    bounds: [corner(bounds[0]), corner(bounds[1])],
    zoomFrom: number(zooms[0], 5),
    zoomTo: number(zooms[1], 8),
    haveZoom: number(tiles['haveZoom'], number(zooms[1], 8)),
    offlineZoomTo: number(tiles['offlineZoomTo'], number(zooms[1], 8)),
    existing: readExisting(tiles['have']),
    weeks: weeks.map(readWeek).filter((week): week is ManifestWeek => week !== null),
  };
}

/** Die ISO-Kalenderwoche eines Tages. */
export function isoWeek(date: Date): { year: number; week: number } {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const days = (day.getTime() - yearStart.getTime()) / 86400000;
  return { year: day.getUTCFullYear(), week: Math.ceil((days + 1) / 7) };
}

/** Die Woche, die beim Öffnen gilt: die laufende Kalenderwoche, wenn das Manifest sie hat, … */
export function currentWeek(manifest: SpeciesManifest, today = new Date()): ManifestWeek | null {
  if (manifest.weeks.length === 0) return null;
  const now = isoWeek(today);
  const current = manifest.weeks.find((week) => week.year === now.year && week.week === now.week);
  return current ?? manifest.weeks[manifest.weeks.length - 1];
}

/** Sucht eine Woche über ihren Schlüssel. */
export function findWeek(manifest: SpeciesManifest, key: string): ManifestWeek | null {
  return manifest.weeks.find((week) => weekKey(week) === key) ?? null;
}

/** Alle Kacheln einer Zoomstufe, die Daten tragen. */
export function tilesAtZoom(manifest: SpeciesManifest, zoom: number): [number, number, number][] {
  const tiles: [number, number, number][] = [];
  for (const key of manifest.existing) {
    const [z, x, y] = key.split('/').map(Number);
    if (z === zoom) tiles.push([z, x, y]);
  }
  return tiles;
}

/** Die Balken der Zeitleiste. */
export function barShares(manifest: SpeciesManifest): readonly number[] {
  const peak = Math.max(1e-9, ...manifest.weeks.map((week) => week.mean));
  return manifest.weeks.map((week) => week.mean / peak);
}
