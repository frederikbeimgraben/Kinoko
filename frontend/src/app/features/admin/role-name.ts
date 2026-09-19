import type { I18nService } from '../../core/i18n/i18n.service';

/** Übersetzt den Namen einer Rolle. Eine eigene Rolle trägt ihren freien Namen, keinen Schlüssel. */
export function roleName(i18n: I18nService, name: string): string {
  return i18n.translateOptional(name);
}
