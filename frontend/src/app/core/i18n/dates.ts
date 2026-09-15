/**
 * Ein Tag, wie ihn eine Person liest. Die Form kommt aus den Mockups:
 * „6. September 2026“.
 *
 * Die beiden Funktionen stehen im Kern und nicht in einer Seite: Funde, Arten
 * und Bilder schreiben denselben Tag, und jede Seite ihre eigene Fassung
 * bauen zu lassen ergäbe drei Schreibweisen.
 */

/**
 * Liest ein ISO-Datum als lokalen Tag. `new Date('2026-09-06')` läge in UTC
 * und verschöbe den Tag östlich der Datumsgrenze.
 */
export function asDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/** „6. September 2026“, so wie das Fund-Blatt es schreibt. */
export function longDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    asDate(iso),
  );
}

/** Übersetzt einen Schlüssel mit Platzhaltern. */
type Translate = (key: string, values?: Record<string, string | number>) => string;

/** „6. Sept.“: Tag und kurzer Monat, das Muster kommt aus dem Katalog. */
export function shortDate(iso: string, locale: string, translate: Translate): string {
  const date = asDate(iso);
  const month = new Intl.DateTimeFormat(locale, { month: 'short' }).format(date);
  return translate('common.dateShort', { tag: date.getDate(), monat: month });
}
