// A circle on the earth as a polygon. The accuracy circle uses meters, so it scales on zoom.
// MapLibre draws circles only in pixels, so this file makes a polygon.

/** Meters per degree of latitude. It is constant over the size of an accuracy circle. */
const METERS_PER_DEGREE = 111320;

/** This number of corners looks round at each zoom and keeps the polygon small. */
const STEPS = 48;

/** A GeoJSON polygon ring around `center` with `radius` in meters. The last point repeats the first. */
export function circleAround(
  center: readonly [number, number],
  radius: number,
  steps = STEPS,
): [number, number][] {
  const [lon, lat] = center;
  const spanLat = radius / METERS_PER_DEGREE;
  // A degree of longitude is shorter near the pole than at the equator.
  // Without the cosine, the circle in Germany is two thirds too wide.
  const spanLon = spanLat / Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);
  const ring: [number, number][] = [];
  for (let step = 0; step < steps; step++) {
    const angle = (2 * Math.PI * step) / steps;
    ring.push([lon + spanLon * Math.cos(angle), lat + spanLat * Math.sin(angle)]);
  }
  ring.push(ring[0]);
  return ring;
}
