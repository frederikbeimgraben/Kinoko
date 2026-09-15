/** Die Funde des Vertrags, so wie die Karte und die Liste sie brauchen. */

import type { components } from '../contract';

export type ReviewState = components['schemas']['ReviewState'];

/** Ein geteilter Fund. Der Ort einer geschützten Art kommt gerundet. */
export interface SharedFind {
  id: string;
  speciesId: string | null;
  lat: number;
  lon: number;
  /** ISO-Datum ohne Zeit. */
  foundOn: string;
  count: number | null;
  note: string | null;
  reviewState: ReviewState;
}
