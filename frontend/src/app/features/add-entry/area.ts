import type { GeoPolygon } from '../../core/api/models';
import type { Location } from './add-entry.store';

/** One hectare is 10 000 square metres. Turf calculates in square metres. */
const SQUARE_METRES_PER_HECTARE = 10_000;

/** Calculates the area of a Turf polygon in hectares. */
export type AreaCalculator = (polygon: GeoPolygon) => number;

let loaded: Promise<AreaCalculator> | null = null;

/** Closes a ring for the contract: the last point is the first. Fewer than three corners give no area. */
export function asPolygon(ring: readonly Location[]): GeoPolygon | null {
  if (ring.length < 3) return null;
  const punkte: [number, number][] = ring.map(([lon, lat]) => [lon, lat]);
  const [firstLon, firstLat] = punkte[0];
  const [lastLon, lastLat] = punkte[punkte.length - 1];
  if (firstLon !== lastLon || firstLat !== lastLat) punkte.push([firstLon, firstLat]);
  return { type: 'Polygon', coordinates: [punkte] };
}

/** Loads Turf when the first area is necessary. It is a separate chunk, not in the first bundle. */
export function loadAreaCalculator(): Promise<AreaCalculator> {
  loaded ??= import('@turf/area').then((module) => {
    const area = module.default;
    return (polygon: GeoPolygon) => area(polygon) / SQUARE_METRES_PER_HECTARE;
  });
  return loaded;
}
