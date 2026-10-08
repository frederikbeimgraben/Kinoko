import type { I18nService } from '../../core/i18n/i18n.service';

/** Translates the name of a role. A custom role has a free name, not a text key. */
export function roleName(i18n: I18nService, name: string): string {
  return i18n.translateOptional(name);
}
