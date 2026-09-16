import type { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';

/** Übersetzt den Namen einer Rolle. Eine eingebaute Rolle trägt einen Textschlüssel. */
export function roleName(i18n: I18nService, name: string): string {
  return i18n.translate(name as TranslationKey);
}
