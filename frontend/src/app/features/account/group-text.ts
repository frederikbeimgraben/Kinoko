import type { I18nService } from '../../core/i18n/i18n.service';
import { grouped } from '../../core/i18n/numbers';

/** „4 Mitglieder“, im Einzelfall „1 Mitglied“. */
export function memberCount(i18n: I18nService, count: number): string {
  if (count === 1) return i18n.translate('group.oneMember');
  return i18n.translate('group.memberCount', { count: grouped(count) });
}
