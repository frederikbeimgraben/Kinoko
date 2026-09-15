/** Die Typen der Fotos, direkt aus dem Vertrag. */

import type { components } from '../contract';

export type Photo = components['schemas']['Photo'];
export type PhotoState = components['schemas']['PhotoState'];
export type PhotoSize = components['schemas']['PhotoSize'];
export type Licence = components['schemas']['Licence'];

export const LICENCES: readonly Licence[] = ['own', 'cc0', 'cc_by_4', 'cc_by_sa_4', 'public_domain'];

export const PHOTO_STATES: readonly PhotoState[] = ['private', 'submitted', 'approved', 'rejected'];

/** Der Weg zu einer Größe eines Fotos. Der Client baut ihn an einer Stelle. */
export function photoPath(id: string, size: PhotoSize): string {
  return `/photos/${encodeURIComponent(id)}/${size}`;
}
