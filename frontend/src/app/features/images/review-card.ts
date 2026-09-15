import { photoPath, type Photo } from '../../core/api/models';
import { shortDate } from '../../core/i18n/dates';
import { locationText } from '../../core/i18n/places';
import { COARSE_DIGITS } from '../../core/location/grid';
import { LICENCE_CODE, OWN_PHOTO_KEY } from '../../ui/image-credit/licences';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';

const SEPARATOR = ' · ';

/** Eine Karte im Prüfstapel. */
export interface ReviewCard {
  id: string;
  path: string;
  species: string;
  licence: string;
  meta: string;
  caption: string | null;
  alt: string;
}

/** Die Lizenz als Kennung. Eigene Aufnahmen tragen ein Wort statt einer Marke. */
export function licenceText(photo: Photo, i18n: I18nService): string {
  return photo.licence === 'own' ? i18n.translate(OWN_PHOTO_KEY) : LICENCE_CODE[photo.licence];
}

/** Wer eingereicht hat, wann und wo. Was fehlt, fällt weg. */
export function metaText(photo: Photo, i18n: I18nService): string {
  const parts = [photo.ownerName];
  const day = photo.takenOn ?? photo.createdAt.slice(0, 10);
  parts.push(shortDate(day, i18n.locale(), (key, values) => i18n.translate(key as TranslationKey, values)));
  if (photo.lat != null && photo.lon != null) {
    const shown = locationText(photo.lat, photo.lon, i18n.locale(), COARSE_DIGITS);
    parts.push(`${shown.lat}${SEPARATOR}${shown.lon}`);
  }
  return parts.join(SEPARATOR);
}

/** Baut die Karte eines Fotos für den Stapel. */
export function reviewCard(photo: Photo, species: string, i18n: I18nService): ReviewCard {
  return {
    id: photo.id,
    path: photoPath(photo.id, 'full'),
    species,
    licence: licenceText(photo, i18n),
    meta: metaText(photo, i18n),
    caption: photo.caption ?? null,
    alt: photo.caption ?? species,
  };
}
