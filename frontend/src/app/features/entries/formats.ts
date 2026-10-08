/** Formats dates, places and areas for the UI, as the mockups show them.
 * `core` has the long day and the place, because species and images use them too. */

import { shortDate as catalogueDay } from '../../core/i18n/dates';
import type { I18nService } from '../../core/i18n/i18n.service';

/** An ISO date without time, as the contract needs for `datum`. */
export function isoDatum(instant: Date): string {
  const month = String(instant.getMonth() + 1).padStart(2, '0');
  const tag = String(instant.getDate()).padStart(2, '0');
  return `${instant.getFullYear()}-${month}-${tag}`;
}

/** The short date for the list, for example „6. Sept.“. For today, it gives „Heute“. */
export function shortDate(iso: string, i18n: I18nService, heute: string): string {
  if (iso === heute) return i18n.translate('common.today');
  return catalogueDay(iso, i18n);
}

/** The first name, as the subline of a find shows it. */
export function firstName(full: string | null): string {
  return (full ?? '').split(' ')[0] ?? '';
}

/** An area in hectares. An area of 10 ha or more shows no decimal places. */
export function hectaresText(hectares: number, locale: string): string {
  const spots = hectares < 10 ? 1 : 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: spots,
    maximumFractionDigits: spots,
  }).format(hectares);
}
