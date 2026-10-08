/**
 * Formats a location for people to read: „48,5203 · 9,0511“. This is in the core, so finds and photos show one format.
 */

import { decimal } from './numbers';

/** Four decimal places are about eleven metres. A finger on a screen is not more precise. */
const LOCATION_DIGITS = 4;

/**
 * A coordinate pair in the format of the language. The default is four digits. A rounded location shows fewer digits, because it has less precision.
 */
export function locationText(
  lat: number,
  lon: number,
  locale: string,
  digits: number = LOCATION_DIGITS,
): { lat: string; lon: string } {
  const options = { minimumFractionDigits: digits, maximumFractionDigits: digits };
  return { lat: decimal(lat, locale, options), lon: decimal(lon, locale, options) };
}

/** The grid size of a coarse location, in kilometres. */
export const COARSE_KM = 1;

/** A coarse location with its grid size: „48,51 · 9,06 · 1 km“. */
export function coarsePlace(lat: number, lon: number, locale: string, digits: number): string {
  const shown = locationText(lat, lon, locale, digits);
  return `${shown.lat} \u00b7 ${shown.lon} \u00b7 ${String(COARSE_KM)} km`;
}
