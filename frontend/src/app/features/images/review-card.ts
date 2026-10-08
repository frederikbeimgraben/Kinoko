import { photoPath, type Photo } from '../../core/api/models';
import { shortDate } from '../../core/i18n/dates';
import { SEPARATOR } from '../../core/i18n/numbers';
import { locationText } from '../../core/i18n/places';
import { COARSE_DIGITS } from '../../core/location/grid';
import { LICENCE_CODE, OWN_PHOTO_KEY } from '../../ui/image-credit/licences';
import type { I18nService } from '../../core/i18n/i18n.service';

/** A card in the review stack. */
export interface ReviewCard {
  id: string;
  path: string;
  species: string;
  licence: string;
  meta: string;
  caption: string | null;
  alt: string;
}

/** The licence as a code. Own photos show a word, not a licence code. */
export function licenceText(photo: Photo, i18n: I18nService): string {
  return photo.licence === 'own' ? i18n.translate(OWN_PHOTO_KEY) : LICENCE_CODE[photo.licence];
}

/** Who sent the photo, when and where. Missing parts are not shown. */
export function metaText(photo: Photo, i18n: I18nService): string {
  const parts = [photo.ownerName];
  const day = photo.takenOn ?? photo.createdAt.slice(0, 10);
  parts.push(shortDate(day, i18n));
  if (photo.lat != null && photo.lon != null) {
    const shown = locationText(photo.lat, photo.lon, i18n.locale(), COARSE_DIGITS);
    parts.push(`${shown.lat}${SEPARATOR}${shown.lon}`);
  }
  return parts.join(SEPARATOR);
}

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
