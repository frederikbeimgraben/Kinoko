import type { GeoPolygon } from '../../core/api/models';
import { covers, type Coverage } from '../../core/tiles/coverage';
import { tilePath } from '../../core/tiles/tile-paths';

/** A box in degrees. */
export interface Bounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

/** A folder of tiles and the zoom levels that an offline area takes from it. */
export interface TileSource extends Coverage {
  readonly folder: string;
  readonly zoomFrom: number;
  readonly zoomTo: number;
}

/** The mean size of one value tile. It gives the size of an area before the download.
 * The real size replaces it after the download. */
export const MEAN_TILE_BYTES = 24_000;

/** The box around all rings of a polygon. */
export function polygonBounds(polygon: GeoPolygon): Bounds {
  const points = polygon.coordinates.flat();
  const lons = points.map((point) => point[0] ?? 0);
  const lats = points.map((point) => point[1] ?? 0);
  return {
    west: Math.min(...lons),
    south: Math.min(...lats),
    east: Math.max(...lons),
    north: Math.max(...lats),
  };
}

/** The tile column of a longitude (Web Mercator, as MapLibre uses it). */
export function tileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

/** The tile row of a latitude (Web Mercator, as MapLibre uses it). */
export function tileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

/** The tiles that a box touches at one zoom level, as `[z, x, y]`. */
export function tilesIn(bounds: Bounds, z: number): (readonly [number, number, number])[] {
  const left = tileX(bounds.west, z);
  const right = tileX(bounds.east, z);
  const top = tileY(bounds.north, z);
  const bottom = tileY(bounds.south, z);
  return Array.from({ length: right - left + 1 }, (_, column) => left + column).flatMap((x) =>
    Array.from({ length: bottom - top + 1 }, (_, row) => [z, x, top + row] as const),
  );
}

/** The paths of all tiles with data in the box, one time each. */
export function areaTilePaths(bounds: Bounds, sources: readonly TileSource[]): readonly string[] {
  const paths = sources.flatMap((source) =>
    Array.from(
      { length: Math.max(0, source.zoomTo - source.zoomFrom + 1) },
      (_, step) => source.zoomFrom + step,
    )
      .flatMap((z) => tilesIn(bounds, z))
      .filter(([z, x, y]) => covers(source, z, x, y))
      .map(([z, x, y]) => tilePath(source.folder, z, x, y)),
  );
  return [...new Set(paths)];
}
