/** The photo types, directly from the contract. */

import type { components } from '../contract';

export type Photo = components['schemas']['Photo'];
export type PhotoState = components['schemas']['PhotoState'];
export type PhotoSize = components['schemas']['PhotoSize'];
export type Licence = components['schemas']['Licence'];

export const LICENCES: readonly Licence[] = ['own', 'cc0', 'cc_by_4', 'cc_by_sa_4', 'public_domain'];

export const PHOTO_STATES: readonly PhotoState[] = ['private', 'submitted', 'approved', 'rejected'];

/** The path to one size of a photo. The client makes it only here. */
export function photoPath(id: string, size: PhotoSize): string {
  return `/photos/${encodeURIComponent(id)}/${size}`;
}
