/** Welche Kacheln eine Quelle trägt. Über `haveZoom` entscheidet die gröbere Kachel. */

import { tileKey } from './tile-paths';

export interface Coverage {
  existing: ReadonlySet<string>;
  haveZoom: number;
}

export function covers(coverage: Coverage, z: number, x: number, y: number): boolean {
  const steps = Math.max(0, z - coverage.haveZoom);
  return coverage.existing.has(tileKey(z - steps, x >> steps, y >> steps));
}
