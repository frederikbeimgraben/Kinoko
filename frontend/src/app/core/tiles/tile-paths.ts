/** Wo die fertigen Karten liegen. */

/** Manifest einer Art: Wochen, Höchstwert, Nachschlagetabelle. */
export function manifestPath(slug: string): string {
  return `/${slug}.json`;
}

/** Eine Wertkachel. */
export function tilePath(weekFolder: string, z: number, x: number, y: number): string {
  return `/${weekFolder}/${z}/${x}/${y}.png`;
}

/** Manifest der Eingabe-Ebenen. */
export const LAYERS_MANIFEST = '/layers.json';

/** Der Schlüssel einer Kachel im Verzeichnis der vorhandenen Kacheln. */
export function tileKey(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}`;
}
