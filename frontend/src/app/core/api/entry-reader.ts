/** Reads a find, a marker and a zone. A tombstone or a partial entry falls out. */

import type { components } from './contract';
import type { Find, Marker, OpenFind, SharedFind, Zone } from './models';

type FindEntry = components['schemas']['Find'];
type OpenFindEntry = components['schemas']['OpenFind'];
type MarkerEntry = components['schemas']['Marker'];
type ZoneEntry = components['schemas']['Zone'];

/** A shared find. The place of a protected species comes rounded. */
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

/** An open find of the review: a shared find, its account and the name of the account. */
export function openFind(entry: OpenFindEntry): OpenFind | null {
  const shared = sharedFind(entry);
  if (shared === null || entry.ownerId === undefined) return null;
  return { ...shared, ownerId: entry.ownerId, ownerName: entry.ownerName ?? null };
}

/** An own find: a shared find with its visibility and its release. */
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
  const groupId = entry.groupId ?? null;
  return { id: entry.id, name, lat, lon, colour, note, visibility, groupId, createdAt: entry.createdAt };
}

export function zone(entry: ZoneEntry): Zone | null {
  const { name, polygon, areaHa, colour, visibility } = entry;
  if (name === undefined || polygon === undefined || areaHa === undefined) return null;
  if (colour === undefined || visibility === undefined || entry.deleted) return null;
  const note = entry.note ?? null;
  const groupId = entry.groupId ?? null;
  return {
    id: entry.id,
    name,
    polygon,
    areaHa,
    colour,
    note,
    visibility,
    groupId,
    createdAt: entry.createdAt,
  };
}
