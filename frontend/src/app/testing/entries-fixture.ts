import type { components } from '../core/api/contract';
import type { Find, SharedFind, Marker, Zone } from '../core/api/models';

type FindEntry = components['schemas']['Find'];
type MarkerEntry = components['schemas']['Marker'];
type ZoneEntry = components['schemas']['Zone'];

/** Eine Seite, wie sie jede Liste des Dienstes liefert. */
export function page<E>(items: readonly E[]): { items: E[]; nextCursor: string | null } {
  return { items: [...items], nextCursor: null };
}

const STAMP = '2026-09-06T10:00:00+02:00';

export const FIND_ENTRY: FindEntry = {
  id: 'fund-eins',
  ownerId: 'konto-eins',
  speciesId: 'steinpilz',
  lat: 48.5203,
  lon: 9.0511,
  foundOn: '2026-09-06',
  count: 3,
  forTraining: true,
  reviewState: 'accepted',
  visibility: 'shared',
  note: 'Unter Fichten am Weg, drei junge, Kappen noch geschlossen.',
  createdAt: STAMP,
  updatedAt: STAMP,
  deleted: false,
};

export const FIND: Find = {
  id: FIND_ENTRY.id,
  speciesId: 'steinpilz',
  lat: 48.5203,
  lon: 9.0511,
  foundOn: '2026-09-06',
  count: 3,
  note: FIND_ENTRY.note ?? null,
  reviewState: 'accepted',
  visibility: 'shared',
  groupId: null,
  forTraining: true,
};

export const MARKER_ENTRY: MarkerEntry = {
  id: 'marker-eins',
  ownerId: 'konto-eins',
  name: 'Alter Fichtenhang',
  lat: 48.53,
  lon: 9.06,
  colour: 'blue',
  note: 'Nordhang, ab Mitte September.',
  visibility: 'private',
  createdAt: '2026-09-01T10:00:00+02:00',
  updatedAt: '2026-09-01T10:00:00+02:00',
  deleted: false,
};

export const MARKER: Marker = {
  id: MARKER_ENTRY.id,
  name: 'Alter Fichtenhang',
  lat: 48.53,
  lon: 9.06,
  colour: 'blue',
  note: MARKER_ENTRY.note ?? null,
  visibility: 'private',
  groupId: null,
};

const RING: number[][][] = [
  [
    [9.0, 48.5],
    [9.1, 48.5],
    [9.1, 48.6],
    [9.0, 48.6],
    [9.0, 48.5],
  ],
];

export const ZONE_ENTRY: ZoneEntry = {
  id: 'zone-eins',
  ownerId: 'konto-eins',
  name: 'Schönbuch Nord',
  polygon: { type: 'Polygon', coordinates: RING },
  areaHa: 42,
  colour: 'green',
  note: 'Nordhang, alte Fichten, ab Mitte September.',
  visibility: 'private',
  createdAt: '2026-09-01T10:00:00+02:00',
  updatedAt: '2026-09-01T10:00:00+02:00',
  deleted: false,
};

export const ZONE: Zone = {
  id: ZONE_ENTRY.id,
  name: 'Schönbuch Nord',
  polygon: { type: 'Polygon', coordinates: RING },
  areaHa: 42,
  colour: 'green',
  note: ZONE_ENTRY.note ?? null,
  visibility: 'private',
  groupId: null,
};

/** Ein geteilter Fund, so wie ihn der Vertrag abgibt. */
export const SHARED_FIND_ENTRY: FindEntry = {
  id: 'geteilt-eins',
  ownerId: 'konto-zwei',
  speciesId: 'maronenroehrling',
  lat: 48.6,
  lon: 9.2,
  foundOn: '2026-09-04',
  count: 5,
  forTraining: false,
  reviewState: 'accepted',
  visibility: 'shared',
  note: 'Wiese am Waldrand, viele junge',
  createdAt: '2026-09-04T10:00:00+02:00',
  updatedAt: '2026-09-04T10:00:00+02:00',
  deleted: false,
};

export const SHARED_FIND: SharedFind = {
  id: 'geteilt-eins',
  speciesId: 'maronenroehrling',
  lat: 48.6,
  lon: 9.2,
  foundOn: '2026-09-04',
  count: 5,
  note: 'Wiese am Waldrand, viele junge',
  reviewState: 'accepted',
};
