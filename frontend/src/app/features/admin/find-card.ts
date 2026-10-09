import { photoPath, type OpenFind, type Photo } from '../../core/api/models';
import { shortDate } from '../../core/i18n/dates';
import { locationText } from '../../core/i18n/places';
import type { I18nService } from '../../core/i18n/i18n.service';
import { findSubline } from '../entries/find-subline';

/** A card in the review stack of finds. */
export interface FindCard {
  id: string;
  species: string;
  place: string;
  meta: string;
  note: string | null;
  photos: readonly string[];
}

/** Date, count and the name of the owner in one line. A missing count or name is left out. */
export function metaText(find: OpenFind, person: string | null, i18n: I18nService): string {
  return findSubline(i18n, shortDate(find.foundOn, i18n), find.count, person);
}

export function findCard(
  find: OpenFind,
  species: string,
  person: string | null,
  photos: readonly Photo[],
  i18n: I18nService,
): FindCard {
  const shown = locationText(find.lat, find.lon, i18n.locale());
  return {
    id: find.id,
    species,
    place: i18n.translate('entry.coordinates', { lat: shown.lat, lon: shown.lon }),
    meta: metaText(find, person, i18n),
    note: find.note,
    photos: photos.map((one) => photoPath(one.id, 'full')),
  };
}
