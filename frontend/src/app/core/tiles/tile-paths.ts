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

/** Trainingsfunde einer Art. */
export function findsPath(slug: string): string {
  return `/funde/${slug}.json`;
}
