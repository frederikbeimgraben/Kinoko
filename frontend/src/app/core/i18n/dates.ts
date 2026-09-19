/**
 * Ein Tag, wie ihn eine Person liest. Die Form kommt aus den Mockups:
 * „6. September 2026“.
 *
 * Die beiden Funktionen stehen im Kern und nicht in einer Seite: Funde, Arten
 * und Bilder schreiben denselben Tag, und jede Seite ihre eigene Fassung
 * bauen zu lassen ergäbe drei Schreibweisen.
 */

import type { I18nService } from './i18n.service';

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

/** Der Tag in Ziffern, so wie ein Formular ihn schreibt. */
export function numericDate(iso: string, translate: Translate): string {
  const date = asDate(iso);
  return translate('common.dateNumeric', {
    tag: date.getDate(),
    monat: date.getMonth() + 1,
    jahr: date.getFullYear(),
  });
}

/** „6. Sept.“: Tag und kurzer Monat, beides aus dem Katalog. */
export function shortDate(iso: string, i18n: I18nService): string {
  return shortDay(asDate(iso), i18n);
}

/** Derselbe Tag aus einem Zeitpunkt, den ein Dienst als Zeitstempel liefert. */
export function shortDay(date: Date, i18n: I18nService): string {
  return i18n.translate('common.dateShort', {
    tag: date.getDate(),
    monat: shortMonth(date.getMonth() + 1, i18n),
  });
}

/** Der kurze Monatsname aus dem Katalog. `month` zählt von 1 bis 12. */
export function shortMonth(month: number, i18n: I18nService): string {
  return i18n.translate(`enum.monthShort.${month}` as 'enum.monthShort.1');
}
