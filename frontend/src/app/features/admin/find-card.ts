import { photoPath, type OpenFind, type Photo } from '../../core/api/models';
import { shortDate } from '../../core/i18n/dates';
import { locationText } from '../../core/i18n/places';
import type { I18nService } from '../../core/i18n/i18n.service';

/** Eine Karte im Prüfstapel der Funde. */
export interface FindCard {
  id: string;
  species: string;
  place: string;
  meta: string;
  note: string | null;
  photos: readonly string[];
}

/** Tag, Anzahl und Konto in einer Zeile. Ohne Anzahl fällt sie weg. */
export function metaText(find: OpenFind, i18n: I18nService): string {
  const date = shortDate(find.foundOn, i18n);
  const person = find.ownerId;
  return find.count === null
    ? i18n.translate('find.sublineNoCount', { date, person })
    : i18n.translate('find.subline', { date, count: find.count, person });
}

/** Baut die Karte eines Fundes für den Stapel. */
export function findCard(
  find: OpenFind,
  species: string,
  photos: readonly Photo[],
  i18n: I18nService,
): FindCard {
  const shown = locationText(find.lat, find.lon, i18n.locale());
  return {
    id: find.id,
    species,
    place: i18n.translate('entry.coordinates', { lat: shown.lat, lon: shown.lon }),
    meta: metaText(find, i18n),
    note: find.note,
    photos: photos.map((one) => photoPath(one.id, 'full')),
  };
}
