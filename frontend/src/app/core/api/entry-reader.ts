/** Liest Fund, Marker und Zone. Ein Grabstein oder ein Teilstand fällt weg. */

import type { components } from './contract';
import type { Find, Marker, OpenFind, SharedFind, Zone } from './models';

type FindEntry = components['schemas']['Find'];
type MarkerEntry = components['schemas']['Marker'];
type ZoneEntry = components['schemas']['Zone'];

/** Ein geteilter Fund. Der Ort einer geschützten Art kommt gerundet. */
export function sharedFind(entry: FindEntry): SharedFind | null {
  const { lat, lon, foundOn, reviewState, ownerId } = entry;
  if (lat === undefined || lon === undefined || foundOn === undefined) return null;
  if (reviewState === undefined || ownerId === undefined || entry.deleted) return null;
  return {
    id: entry.id,
    ownerId,
    speciesId: entry.speciesId ?? null,
    lat,
    lon,
    foundOn,
    count: entry.count ?? null,
    note: entry.note ?? null,
    reviewState,
  };
}

/** Ein offener Fund der Prüfung: ein geteilter, dazu sein Konto. */
export function openFind(entry: FindEntry): OpenFind | null {
  const shared = sharedFind(entry);
  if (shared === null || entry.ownerId === undefined) return null;
  return { ...shared, ownerId: entry.ownerId };
}

/** Ein eigener Fund: ein geteilter, dazu Sichtbarkeit und Freigabe. */
export function ownFind(entry: FindEntry): Find | null {
  const shared = sharedFind(entry);
  if (shared === null || entry.visibility === undefined) return null;
  return {
    ...shared,
    visibility: entry.visibility,
    groupId: entry.groupId ?? null,
    forTraining: entry.forTraining ?? false,
  };
}

export function marker(entry: MarkerEntry): Marker | null {
  const { name, lat, lon, colour, visibility } = entry;
  if (name === undefined || lat === undefined || lon === undefined) return null;
  if (colour === undefined || visibility === undefined || entry.deleted) return null;
  const note = entry.note ?? null;
  return { id: entry.id, name, lat, lon, colour, note, visibility, groupId: entry.groupId ?? null };
}

export function zone(entry: ZoneEntry): Zone | null {
  const { name, polygon, areaHa, colour, visibility } = entry;
  if (name === undefined || polygon === undefined || areaHa === undefined) return null;
  if (colour === undefined || visibility === undefined || entry.deleted) return null;
  const note = entry.note ?? null;
  const groupId = entry.groupId ?? null;
  return { id: entry.id, name, polygon, areaHa, colour, note, visibility, groupId };
}
