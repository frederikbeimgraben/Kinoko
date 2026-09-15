import type { Photo } from '../core/api/models';

/** Ein Foto des Vertrags. Jedes Feld lässt sich einzeln überschreiben. */
export function photo(override: Partial<Photo> = {}): Photo {
  return {
    id: 'bild-eins',
    ownerId: 'person-eins',
    speciesId: 'art-eins',
    findId: null,
    width: 1600,
    height: 1200,
    photographer: 'Marie Weber',
    licence: 'cc_by_sa_4',
    caption: null,
    takenOn: '2026-09-06',
    lat: null,
    lon: null,
    lead: true,
    state: 'approved',
    rejectReason: null,
    reviewedById: null,
    reviewedAt: null,
    createdAt: '2026-09-09T08:00:00+02:00',
    updatedAt: '2026-09-09T08:00:00+02:00',
    ...override,
  };
}
