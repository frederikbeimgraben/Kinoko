import type { I18nService } from '../../core/i18n/i18n.service';
import { locationText } from '../../core/i18n/places';
import type { Location } from './add-entry.store';

/** Longitude and latitude, as the head of a form shows them. */
export function coordinatesText(location: Location | null, i18n: I18nService): string {
  if (location === null) return '';
  const [lon, lat] = location;
  const text = locationText(lat, lon, i18n.locale());
  return i18n.translate('entry.coordinates', { lat: text.lat, lon: text.lon });
}
