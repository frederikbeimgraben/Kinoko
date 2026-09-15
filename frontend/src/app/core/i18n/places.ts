/**
 * Ein Ort, wie ihn eine Person liest: „48,5203 · 9,0511“.
 *
 * Die Funktion steht im Kern und nicht in einer Seite: Funde und Bilder
 * schreiben denselben Ort, und jede Seite ihre eigene Fassung bauen zu lassen
 * ergäbe zwei Schreibweisen.
 */

/** Vier Nachkommastellen sind rund elf Meter; genauer trifft kein Daumen. */
const LOCATION_DIGITS = 4;

/**
 * Ein Koordinatenpaar in der Schreibweise der Sprache. Vier Stellen sind der
 * Regelfall; ein gerundeter Ort nennt weniger, weil er nicht mehr weiß.
 */
export function locationText(
  lat: number,
  lon: number,
  locale: string,
  digits: number = LOCATION_DIGITS,
): { lat: string; lon: string } {
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return { lat: format.format(lat), lon: format.format(lon) };
}

/** Die Maschenweite, auf der ein grober Ort steht, in Kilometern. */
export const COARSE_KM = 1;

/** Ein grober Ort mit seiner Maschenweite: „48,51 · 9,06 · 1 km“. */
export function coarsePlace(lat: number, lon: number, locale: string, digits: number): string {
  const shown = locationText(lat, lon, locale, digits);
  return `${shown.lat} \u00b7 ${shown.lon} \u00b7 ${String(COARSE_KM)} km`;
}
