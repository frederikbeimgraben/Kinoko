import type { Find, FindWrite, Marker, MarkerWrite, Zone, ZoneWrite } from '../../core/api/models';

/** The write body of a find. `PUT` replaces the find, so the body has all fields. */
export function findWrite(find: Find): FindWrite {
  return {
    speciesId: find.speciesId,
    lat: find.lat,
    lon: find.lon,
    foundOn: find.foundOn,
    count: find.count,
    note: find.note,
    visibility: find.visibility,
    forTraining: find.forTraining,
  };
}

export function markerWrite(marker: Marker): MarkerWrite {
  return {
    name: marker.name,
    lat: marker.lat,
    lon: marker.lon,
    colour: marker.colour,
    note: marker.note,
    visibility: marker.visibility,
  };
}

export function zoneWrite(zone: Zone): ZoneWrite {
  return {
    name: zone.name,
    polygon: zone.polygon,
    colour: zone.colour,
    note: zone.note,
    visibility: zone.visibility,
  };
}
