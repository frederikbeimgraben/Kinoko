import type { GeoPolygon, Visibility } from '../../core/api/models';
import { asDate } from '../../core/i18n/dates';

/** The time chips of `EntriesFilterBody.dc.html`: today, this week, this month, this year. */
export type TimeSpan = 'today' | 'week' | 'month' | 'year';

export const TIME_SPANS: readonly TimeSpan[] = ['today', 'week', 'month', 'year'];

/** The choice of the entries filter. `null` in a field means: no limit. */
export interface EntriesFilter {
  readonly visibility: Visibility | null;
  readonly groupId: string | null;
  readonly zoneId: string | null;
  readonly time: TimeSpan | null;
  readonly withPhoto: boolean;
}

export const NO_FILTER: EntriesFilter = {
  visibility: null,
  groupId: null,
  zoneId: null,
  time: null,
  withPhoto: false,
};

/** What the filter reads of a find. Shared finds of other people have no visibility and no group. */
export interface FilterableFind {
  readonly id: string;
  readonly lat: number;
  readonly lon: number;
  readonly foundOn: string;
  /** `shared` for a find of another person. */
  readonly visibility: Visibility;
  readonly groupId: string | null;
}

/** What the filter needs besides the find. */
export interface FilterContext {
  /** The day of the filter as an ISO date. */
  readonly today: string;
  readonly zone: GeoPolygon | null;
  readonly photoFinds: ReadonlySet<string>;
}

/** True when the filter limits the list. */
export function isFiltered(filter: EntriesFilter): boolean {
  return (
    filter.visibility !== null ||
    filter.groupId !== null ||
    filter.zoneId !== null ||
    filter.time !== null ||
    filter.withPhoto
  );
}

/** The Monday of the week of a day, as an ISO date. */
function weekStart(day: Date): Date {
  const offset = (day.getDay() + 6) % 7;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - offset);
}

/** True when the day is in the span that ends on `today`. */
export function inSpan(iso: string, span: TimeSpan, today: string): boolean {
  const day = asDate(iso);
  const now = asDate(today);
  switch (span) {
    case 'today':
      return iso === today;
    case 'week':
      return weekStart(day).getTime() === weekStart(now).getTime();
    case 'month':
      return day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth();
    case 'year':
      return day.getFullYear() === now.getFullYear();
  }
}

/** Ray casting on one ring: true when the point is inside. */
function inRing(lon: number, lat: number, ring: readonly (readonly number[])[]): boolean {
  return ring.reduce((inside, point, index) => {
    const [x1 = 0, y1 = 0] = point;
    const [x2 = 0, y2 = 0] = ring[(index + ring.length - 1) % ring.length] ?? [];
    const crosses = y1 > lat !== y2 > lat && lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1;
    return crosses ? !inside : inside;
  }, false);
}

/** True when the point is in the outer ring and in no hole of the polygon. */
export function inPolygon(lon: number, lat: number, polygon: GeoPolygon): boolean {
  const [outer, ...holes] = polygon.coordinates;
  return outer !== undefined && inRing(lon, lat, outer) && !holes.some((hole) => inRing(lon, lat, hole));
}

/** True when the find passes each part of the filter. */
export function passes(find: FilterableFind, filter: EntriesFilter, context: FilterContext): boolean {
  return (
    (filter.visibility === null || find.visibility === filter.visibility) &&
    (filter.groupId === null || find.groupId === filter.groupId) &&
    (filter.time === null || inSpan(find.foundOn, filter.time, context.today)) &&
    (context.zone === null || inPolygon(find.lon, find.lat, context.zone)) &&
    (!filter.withPhoto || context.photoFinds.has(find.id))
  );
}
