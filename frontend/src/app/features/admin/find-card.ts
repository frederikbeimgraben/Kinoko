import { photoPath, type OpenFind, type Photo } from '../../core/api/models';
import { shortDate } from '../../core/i18n/dates';
import { locationText } from '../../core/i18n/places';
import type { I18nService } from '../../core/i18n/i18n.service';
import { findSubline } from '../entries/find-subline';

/** Eine Karte im Prüfstapel der Funde. */
export interface FindCard {
  id: string;
  species: string;
  place: string;
  meta: string;
  note: string | null;
  photos: readonly string[];
}

/** Baut die Karte eines Fundes für den Stapel. `person` bleibt `null` ohne Auflösung. */
export function findCard(
  find: OpenFind,
  species: string,
  photos: readonly Photo[],
  i18n: I18nService,
  person: string | null,
): FindCard {
  const shown = locationText(find.lat, find.lon, i18n.locale());
  const date = shortDate(find.foundOn, i18n);
  return {
    id: find.id,
    species,
    place: i18n.translate('entry.coordinates', { lat: shown.lat, lon: shown.lon }),
    meta: findSubline(i18n, date, find.count, person),
    note: find.note,
    photos: photos.map((one) => photoPath(one.id, 'full')),
  };
}
