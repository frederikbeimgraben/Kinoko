import type { I18nService } from '../../core/i18n/i18n.service';

/** Die Unterzeile eines Fundes: Datum, Anzahl, Melder. Ohne auflösbaren Melder bleibt der Name weg. */
export function findSubline(
  i18n: I18nService,
  date: string,
  count: number | null,
  person: string | null,
): string {
  if (person === null) {
    return count === null ? date : i18n.translate('find.sublineShared', { date, count });
  }
  if (count === null) return i18n.translate('find.sublineNoCount', { date, person });
  return i18n.translate('find.subline', { date, count, person });
}
