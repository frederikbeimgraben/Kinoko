import type { GeoPolygon } from '../../core/api/models';
import type { Location } from './add-entry.store';

/** One hectare is 10 000 square metres. */
const SQUARE_METRES_PER_HECTARE = 10_000;

/** The earth radius of the service (`backend/internal/core/geo`). */
const EARTH_RADIUS_M = 6_371_000;

const RADIANS_PER_DEGREE = Math.PI / 180;

/** Closes a ring for the contract: the last point is the first. Fewer than three corners give no area. */
export function asPolygon(ring: readonly Location[]): GeoPolygon | null {
  if (ring.length < 3) return null;
  const punkte: [number, number][] = ring.map(([lon, lat]) => [lon, lat]);
  const [firstLon, firstLat] = punkte[0];
  const [lastLon, lastLat] = punkte[punkte.length - 1];
  if (firstLon !== lastLon || firstLat !== lastLat) punkte.push([firstLon, firstLat]);
  return { type: 'Polygon', coordinates: [punkte] };
}

/** The area in hectares, with the plane formula of the service at the mean latitude (`geo.AreaHa`).
 * Thus the drawing step shows the same area as the saved zone. */
export function areaHa(polygon: GeoPolygon): number {
  const ring = polygon.coordinates[0];
  if (ring.length < 4) return 0;
  const meanLat = (ring.reduce((sum, point) => sum + point[1], 0) / ring.length) * RADIANS_PER_DEGREE;
  const metreLon = RADIANS_PER_DEGREE * EARTH_RADIUS_M * Math.cos(meanLat);
  const metreLat = RADIANS_PER_DEGREE * EARTH_RADIUS_M;
  const twice = ring
    .slice(0, -1)
    .reduce(
      (sum, first, index) =>
        sum +
        first[0] * metreLon * (ring[index + 1][1] * metreLat) -
        ring[index + 1][0] * metreLon * (first[1] * metreLat),
      0,
    );
  return Math.abs(twice) / 2 / SQUARE_METRES_PER_HECTARE;
}
