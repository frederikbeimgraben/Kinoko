/**
 * Formats a day for people to read. The format comes from the mockups. These functions are in the core, so finds, species and photos all show one format.
 */

import type { I18nService } from './i18n.service';

/**
 * Reads an ISO date as a local day. `new Date(iso)` uses UTC and can move the day by one in some time zones.
 */
export function asDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/** Day, full month and year, as the find sheet shows it. */
export function longDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    asDate(iso),
  );
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The day in digits, as a form shows it. */
export function numericDate(iso: string, translate: Translate): string {
  const date = asDate(iso);
  return translate('common.dateNumeric', {
    tag: date.getDate(),
    monat: date.getMonth() + 1,
    jahr: date.getFullYear(),
  });
}

/** Day and short month, both from the catalogue. */
export function shortDate(iso: string, i18n: I18nService): string {
  return shortDay(asDate(iso), i18n);
}

/** The same format for a `Date`, for example from a service timestamp. */
export function shortDay(date: Date, i18n: I18nService): string {
  return i18n.translate('common.dateShort', {
    tag: date.getDate(),
    monat: shortMonth(date.getMonth() + 1, i18n),
  });
}

/** The short month name from the catalogue. `month` is 1 to 12. */
export function shortMonth(month: number, i18n: I18nService): string {
  return i18n.translate(`enum.monthShort.${month}` as 'enum.monthShort.1');
}
