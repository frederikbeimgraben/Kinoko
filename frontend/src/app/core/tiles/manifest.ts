/** The manifest of a forecast species, as `modell/src/pilze/region_map.py` writes it. */

import { readHistogram, type Histogram } from './layers';
import { tileKey } from './tile-paths';

export { tileKey };

export interface ManifestWeek {
  year: number;
  week: number;
  /** A week without measured weather. The values come from the weather forecast. */
  forecast: boolean;
  /** The tile folder of this week, without a leading slash. */
  tilePath: string;
  mean: number;
  max: number;
  /** The distribution of the week over Germany, with zero as the lowest value. */
  histogram: Histogram | null;
}

/** A species with forecast: tiles, weeks and the maximum of the color ramp. */
export interface SpeciesManifest {
  slug: string;
  /** The scientific names that the species includes. */
  species: readonly string[];
  /** The value of byte 255 in a tile. */
  top: number;
  /** South-west and north-east corner as [lon, lat], as MapLibre expects. */
  bounds: readonly [readonly [number, number], readonly [number, number]];
  zoomFrom: number;
  zoomTo: number;
  /** The coarsest zoom level whose tiles `existing` lists one by one. */
  haveZoom: number;
  /** The finest zoom level that an offline area keeps. */
  offlineZoomTo: number;
  /** All tiles with data, as `z/x/y`. */
  existing: ReadonlySet<string>;
  weeks: readonly ManifestWeek[];
}

/** The text key of a week: year, dash, week number. */
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
  // The pipeline writes [lat, lon]. MapLibre expects [lon, lat].
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

/** The ISO week of a day. */
export function isoWeek(date: Date): { year: number; week: number } {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const days = (day.getTime() - yearStart.getTime()) / 86400000;
  return { year: day.getUTCFullYear(), week: Math.ceil((days + 1) / 7) };
}

/** The week to show on open: the current ISO week if the manifest has it, else the latest week. */
export function currentWeek(manifest: SpeciesManifest, today = new Date()): ManifestWeek | null {
  if (manifest.weeks.length === 0) return null;
  const now = isoWeek(today);
  const current = manifest.weeks.find((week) => week.year === now.year && week.week === now.week);
  return current ?? manifest.weeks[manifest.weeks.length - 1];
}

/** Tells if a week comes after the current week. Only such weeks use the forecast style. */
export function isFuture(week: { year: number; week: number }, today: Date): boolean {
  const now = isoWeek(today);
  return week.year > now.year || (week.year === now.year && week.week > now.week);
}

export function findWeek(manifest: SpeciesManifest, key: string): ManifestWeek | null {
  return manifest.weeks.find((week) => weekKey(week) === key) ?? null;
}

/** All tiles with data at one zoom level. */
export function tilesAtZoom(manifest: SpeciesManifest, zoom: number): [number, number, number][] {
  const tiles: [number, number, number][] = [];
  for (const key of manifest.existing) {
    const [z, x, y] = key.split('/').map(Number);
    if (z === zoom) tiles.push([z, x, y]);
  }
  return tiles;
}

/** The bar heights of the timeline, relative to the highest mean. */
export function barShares(manifest: SpeciesManifest): readonly number[] {
  const peak = Math.max(1e-9, ...manifest.weeks.map((week) => week.mean));
  return manifest.weeks.map((week) => week.mean / peak);
}
