import type { components } from '../../core/api/contract';
import type { AccountExport } from '../../core/api/models';
import type { SpeciesName } from './export-files';

type ExportFind = components['schemas']['Find'];
type ExportMarker = components['schemas']['Marker'];
type ExportZone = components['schemas']['Zone'];

const XML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function xml(text: string): string {
  return text.replace(/[&<>"']/g, (sign) => XML_ESCAPES[sign]);
}

/** A GPX element with text, or nothing for an empty text. */
function element(tag: string, text: string | null | undefined): string {
  return text ? `<${tag}>${xml(text)}</${tag}>` : '';
}

/** A GPX waypoint. GPX wants a full instant, so a date gets midnight UTC. */
function waypoint(
  lat: number,
  lon: number,
  name: string,
  note: string | null | undefined,
  type: string,
  date?: string,
): string {
  const time = date ? `<time>${date.length === 10 ? `${date}T00:00:00Z` : date}</time>` : '';
  return `  <wpt lat="${String(lat)}" lon="${String(lon)}">${time}${element('name', name)}${element('desc', note)}<type>${type}</type></wpt>`;
}

function findPoint(find: ExportFind, species: SpeciesName): string | null {
  if (find.lat === undefined || find.lon === undefined || find.deleted) return null;
  return waypoint(find.lat, find.lon, species(find.speciesId)?.name ?? '', find.note, 'find', find.foundOn);
}

function markerPoint(marker: ExportMarker): string | null {
  if (marker.lat === undefined || marker.lon === undefined || marker.deleted) return null;
  return waypoint(marker.lat, marker.lon, marker.name ?? '', marker.note, 'marker');
}

/** A zone is a closed track: GPX has no polygon. Each ring is one segment. */
function zoneTrack(zone: ExportZone): string | null {
  if (zone.polygon === undefined || zone.deleted) return null;
  const segments = zone.polygon.coordinates.map(
    (ring) =>
      `<trkseg>${ring.map(([lon, lat]) => `<trkpt lat="${String(lat)}" lon="${String(lon)}"/>`).join('')}</trkseg>`,
  );
  return `  <trk>${element('name', zone.name)}${element('desc', zone.note)}<type>zone</type>${segments.join('')}</trk>`;
}

/** GPX 1.1: finds and markers as waypoints, zones as tracks. Waypoints come first, as the schema wants. */
export function toGpx(data: AccountExport, species: SpeciesName): string {
  const points = [...data.finds.map((find) => findPoint(find, species)), ...data.markers.map(markerPoint)];
  const tracks = data.zones.map(zoneTrack);
  const body = [...points, ...tracks].filter((line): line is string => line !== null);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Kinoko" xmlns="http://www.topografix.com/GPX/1/1">',
    ...body,
    '</gpx>',
    '',
  ].join('\n');
}
