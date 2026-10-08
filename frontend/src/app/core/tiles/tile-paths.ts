/** The paths of the finished maps. */

/** The manifest of a species: weeks, maximum and lookup table. */
export function manifestPath(slug: string): string {
  return `/${slug}.json`;
}

export function tilePath(weekFolder: string, z: number, x: number, y: number): string {
  return `/${weekFolder}/${z}/${x}/${y}.png`;
}

export const LAYERS_MANIFEST = '/layers.json';

/** The key of a tile in the list of tiles with data. */
export function tileKey(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}`;
}
