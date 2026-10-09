import type { AccountExport, SpeciesEntry } from '../../core/api/models';
import { DEFAULT_LOCALE } from '../../core/i18n/translations';
import { isoDatum } from '../entries/formats';
import { toGpx } from './export-gpx';

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

/** The names of a species in the export: the name in the UI language and the scientific name. */
export interface SpeciesLabel {
  readonly name: string;
  readonly scientific: string;
}

/** Gives the names of the species of an id, or `null` for no or an unknown species. */
export type SpeciesName = (id: string | null | undefined) => SpeciesLabel | null;

/** The species names of the export. The catalogue has German names only,
 * so another language gets the scientific name, which every reader knows. */
export function speciesNames(
  entry: (id: string) => Pick<SpeciesEntry, 'name' | 'scientificName'> | null,
  locale: string,
): SpeciesName {
  return (id) => {
    const known = id ? entry(id) : null;
    if (known === null) return null;
    return {
      name: locale === DEFAULT_LOCALE ? known.name : known.scientificName,
      scientific: known.scientificName,
    };
  };
}

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

const CSV_HEAD = [
  'kind',
  'id',
  'name',
  'scientific_name',
  'date',
  'lat',
  'lon',
  'count',
  'area_ha',
  'visibility',
  'note',
] as const;

type CsvValue = string | number | null | undefined;
type CsvRow = readonly CsvValue[];

/** The values of a row by column. A missing column stays empty. */
type CsvLine = Partial<Record<(typeof CSV_HEAD)[number], CsvValue>>;

/** A CSV field. A field with a separator, a quote or a line break goes in quotes. */
function csvField(value: CsvValue): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** The local day of an instant. Each kind has a day only, as a find has its `foundOn`. */
function day(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length === 10 ? value : isoDatum(new Date(value));
}

/** The area with two decimal places, so that a spreadsheet reads it as a number. */
function hectares(area: number | null | undefined): number | null {
  return area === null || area === undefined ? null : Math.round(area * 100) / 100;
}

function speciesColumns(species: SpeciesName, id: string | null | undefined): CsvLine {
  const label = species(id);
  return { name: label?.name, scientific_name: label?.scientific };
}

/** One CSV file for all parts. The column `kind` tells the part of a row. */
export function toCsv(data: AccountExport, species: SpeciesName): string {
  const lines: CsvLine[] = [
    ...data.finds
      .filter((find) => !find.deleted)
      .map((find): CsvLine => ({
        kind: 'find',
        id: find.id,
        ...speciesColumns(species, find.speciesId),
        date: day(find.foundOn),
        lat: find.lat,
        lon: find.lon,
        count: find.count,
        visibility: find.visibility,
        note: find.note,
      })),
    ...data.markers
      .filter((marker) => !marker.deleted)
      .map((marker): CsvLine => ({
        kind: 'marker',
        id: marker.id,
        name: marker.name,
        date: day(marker.createdAt ?? marker.updatedAt),
        lat: marker.lat,
        lon: marker.lon,
        visibility: marker.visibility,
        note: marker.note,
      })),
    ...data.zones
      .filter((zone) => !zone.deleted)
      .map((zone): CsvLine => ({
        kind: 'zone',
        id: zone.id,
        name: zone.name,
        date: day(zone.createdAt ?? zone.updatedAt),
        area_ha: hectares(zone.areaHa),
        visibility: zone.visibility,
        note: zone.note,
      })),
    ...data.photos.map((photo): CsvLine => ({
      kind: 'photo',
      id: photo.id,
      ...speciesColumns(species, photo.speciesId),
      date: day(photo.takenOn ?? photo.createdAt),
      lat: photo.lat,
      lon: photo.lon,
      visibility: photo.state,
      note: photo.caption,
    })),
    ...data.combinations
      .filter((combination) => !combination.deleted)
      .map((combination): CsvLine => ({
        kind: 'combination',
        id: combination.id,
        name: combination.name,
        date: day(combination.createdAt ?? combination.updatedAt),
      })),
  ];
  const rows = lines.map((line): CsvRow => CSV_HEAD.map((column) => line[column]));
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
