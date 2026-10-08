import type { components } from '../../core/api/contract';
import type { AccountExport } from '../../core/api/models';

/** The file formats of the export sheet, per `DataExportBody.dc.html`. */
export type ExportFormat = 'json' | 'csv' | 'gpx';

/** The parts of the export that a person can select. */
export type ExportPart = 'finds' | 'markers' | 'zones' | 'photos' | 'combinations';

export const EXPORT_PARTS: readonly ExportPart[] = ['finds', 'markers', 'zones', 'photos', 'combinations'];

/** GPX holds points and lines only: images and combinations have no place in it. */
export const GEO_PARTS: ReadonlySet<ExportPart> = new Set<ExportPart>(['finds', 'markers', 'zones']);

/** A file that is ready for the download. */
export interface ExportFile {
  readonly name: string;
  readonly type: string;
  readonly content: string;
}

type ExportFind = components['schemas']['Find'];
type ExportMarker = components['schemas']['Marker'];
type ExportZone = components['schemas']['Zone'];

/** Gives the species name for an id, or an empty text. */
export type SpeciesName = (id: string | null | undefined) => string;

/** The parts that a format can hold. */
export function partsFor(format: ExportFormat): readonly ExportPart[] {
  return format === 'gpx' ? EXPORT_PARTS.filter((part) => GEO_PARTS.has(part)) : EXPORT_PARTS;
}

/** The export without the parts that are not selected. The account data `me` stays. */
export function selected(data: AccountExport, parts: ReadonlySet<ExportPart>): AccountExport {
  return {
    me: data.me,
    finds: parts.has('finds') ? data.finds : [],
    markers: parts.has('markers') ? data.markers : [],
    zones: parts.has('zones') ? data.zones : [],
    photos: parts.has('photos') ? data.photos : [],
    combinations: parts.has('combinations') ? data.combinations : [],
  };
}

const XML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function xml(text: string): string {
  return text.replace(/[&<>"']/g, (sign) => XML_ESCAPES[sign] ?? sign);
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
  return waypoint(find.lat, find.lon, species(find.speciesId), find.note, 'find', find.foundOn);
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

const CSV_HEAD = ['kind', 'id', 'name', 'date', 'lat', 'lon', 'count', 'visibility', 'note'] as const;

type CsvRow = readonly (string | number | null | undefined)[];

/** A CSV field. A field with a separator, a quote or a line break goes in quotes. */
function csvField(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** One CSV file for all parts. The column `kind` tells the part of a row. */
export function toCsv(data: AccountExport, species: SpeciesName): string {
  const rows: CsvRow[] = [
    ...data.finds
      .filter((find) => !find.deleted)
      .map((find): CsvRow => [
        'find',
        find.id,
        species(find.speciesId),
        find.foundOn,
        find.lat,
        find.lon,
        find.count,
        find.visibility,
        find.note,
      ]),
    ...data.markers
      .filter((marker) => !marker.deleted)
      .map((marker): CsvRow => [
        'marker',
        marker.id,
        marker.name,
        marker.updatedAt,
        marker.lat,
        marker.lon,
        null,
        marker.visibility,
        marker.note,
      ]),
    ...data.zones
      .filter((zone) => !zone.deleted)
      .map((zone): CsvRow => [
        'zone',
        zone.id,
        zone.name,
        zone.updatedAt,
        null,
        null,
        zone.areaHa,
        zone.visibility,
        zone.note,
      ]),
    ...data.photos.map((photo): CsvRow => [
      'photo',
      photo.id,
      species(photo.speciesId),
      photo.takenOn ?? photo.createdAt,
      photo.lat,
      photo.lon,
      null,
      photo.state,
      photo.caption,
    ]),
    ...data.combinations
      .filter((combination) => !combination.deleted)
      .map((combination): CsvRow => [
        'combination',
        combination.id,
        combination.name,
        combination.updatedAt,
        null,
        null,
        null,
        null,
        null,
      ]),
  ];
  return [CSV_HEAD, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}

/** The file of a format, named after the day of the export. */
export function exportFile(
  data: AccountExport,
  format: ExportFormat,
  species: SpeciesName,
  day: string,
): ExportFile {
  const name = `kinoko-export-${day}`;
  if (format === 'gpx') {
    return { name: `${name}.gpx`, type: 'application/gpx+xml', content: toGpx(data, species) };
  }
  if (format === 'csv') return { name: `${name}.csv`, type: 'text/csv', content: toCsv(data, species) };
  return { name: `${name}.json`, type: 'application/json', content: JSON.stringify(data, null, 2) };
}
