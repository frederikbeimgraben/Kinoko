import { photoPath, type OpenFind, type Photo, type SpeciesEntry } from '../../core/api/models';
import { asDate } from '../../core/i18n/dates';
import type { I18nService } from '../../core/i18n/i18n.service';
import { locationText } from '../../core/i18n/places';

/** One label and value row of a card, per the board `FindQueue`. */
export interface FindCardRow {
  readonly label: string;
  readonly value: string;
}

/** A card in the review stack of finds: map, species, note and the facts of the report. */
export interface FindCard {
  readonly id: string;
  readonly species: string;
  readonly note: string;
  /** The cap colour of the species, for the thumb and the pin. */
  readonly colour: string;
  /** The first photo of the find for the thumb, or an empty text. */
  readonly photo: string;
  /** The find as [longitude, latitude]. */
  readonly point: readonly [number, number];
  readonly rows: readonly FindCardRow[];
}

const FALLBACK_COLOUR = '#7a5230';

/** Day and full month, as the board shows it: "6. September". */
export function dayAndMonth(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(asDate(iso));
}

function capColour(species: SpeciesEntry | null): string {
  return species?.colours.find((group) => group.part === 'cap')?.colours[0]?.hex ?? FALLBACK_COLOUR;
}

/** The rows Melder, Datum, Ort and Anzahl. A find without a count has no Anzahl row. */
function rowsOf(find: OpenFind, i18n: I18nService): readonly FindCardRow[] {
  const shown = locationText(find.lat, find.lon, i18n.locale());
  const row = (label: Parameters<I18nService['translate']>[0], value: string): FindCardRow => ({
    label: i18n.translate(label),
    value,
  });
  return [
    row('find.queue.reporter', find.ownerName ?? i18n.translate('find.queue.unknownReporter')),
    row('entry.field.date', dayAndMonth(find.foundOn, i18n.locale())),
    row('entry.field.location', i18n.translate('entry.coordinates', { lat: shown.lat, lon: shown.lon })),
    ...(find.count === null
      ? []
      : [row('entry.field.count', i18n.translate('find.pieces', { count: find.count }))]),
  ];
}

export function findCard(
  find: OpenFind,
  species: SpeciesEntry | null,
  photos: readonly Photo[],
  i18n: I18nService,
): FindCard {
  const lead = photos.find((one) => one.lead) ?? photos.at(0);
  return {
    id: find.id,
    species: species?.name ?? i18n.translate('find.unknownSpecies'),
    note: find.note ?? '',
    colour: capColour(species),
    photo: lead === undefined ? '' : photoPath(lead.id, 'list'),
    point: [find.lon, find.lat],
    rows: rowsOf(find, i18n),
  };
}
