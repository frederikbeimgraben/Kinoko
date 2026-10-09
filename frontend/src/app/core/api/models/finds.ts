/** The contract finds, in the form that the map and the list need. */

import type { components } from '../contract';

export type ReviewState = components['schemas']['ReviewState'];

/** A shared find. The location of a protected species is rounded. */
export interface SharedFind {
  id: string;
  ownerId: string;
  speciesId: string | null;
  lat: number;
  lon: number;
  /** ISO date without time. */
  foundOn: string;
  count: number | null;
  note: string | null;
  reviewState: ReviewState;
}

/** An open find in review. It names the account that owns it and the name of that person. */
export interface OpenFind extends SharedFind {
  ownerId: string;
  ownerName: string | null;
}
