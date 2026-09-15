import type { components } from '../core/api/contract';
import type { Find, SharedFind, Marker, Page, Zone } from '../core/api/models';

type FindEntry = components['schemas']['Find'];

/** Eine Seite, wie sie jede Liste des Dienstes liefert. */
export function page<E>(eintraege: E[]): Page<E> {
  return { eintraege, gesamt: eintraege.length, limit: 200, offset: 0 };
}

export const FIND: Find = {
  id: 'fund-eins',
  artSlug: 'steinpilz',
  lat: 48.5203,
  lon: 9.0511,
  datum: '2026-09-06',
  anzahl: 3,
  notiz: 'Unter Fichten am Weg, drei junge, Kappen noch geschlossen.',
  sichtbarkeit: 'geteilt',
  fuerTraining: true,
  fotos: [{ id: 'foto-eins', breite: 1600, hoehe: 1200, erstelltAm: '2026-09-06T10:00:00+02:00' }],
  erstelltAm: '2026-09-06T10:00:00+02:00',
  geaendertAm: '2026-09-06T10:00:00+02:00',
};

export const MARKER: Marker = {
  id: 'marker-eins',
  name: 'Alter Fichtenhang',
  lat: 48.53,
  lon: 9.06,
  farbe: 'blau',
  notiz: 'Nordhang, ab Mitte September.',
  sichtbarkeit: 'privat',
  erstelltAm: '2026-09-01T10:00:00+02:00',
  geaendertAm: '2026-09-01T10:00:00+02:00',
};

export const ZONE: Zone = {
  id: 'zone-eins',
  name: 'Schönbuch Nord',
  polygon: {
    type: 'Polygon',
    coordinates: [
      [
        [9.0, 48.5],
        [9.1, 48.5],
        [9.1, 48.6],
        [9.0, 48.6],
        [9.0, 48.5],
      ],
    ],
  },
  flaecheHa: 42,
  farbe: 'gruen',
  notiz: 'Nordhang, alte Fichten, ab Mitte September.',
  sichtbarkeit: 'privat',
  erstelltAm: '2026-09-01T10:00:00+02:00',
  geaendertAm: '2026-09-01T10:00:00+02:00',
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

/** Eine Seite Funde des Vertrags. */
export function findPage(items: readonly FindEntry[]): components['schemas']['FindPage'] {
  return { items: [...items], nextCursor: null };
}

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
