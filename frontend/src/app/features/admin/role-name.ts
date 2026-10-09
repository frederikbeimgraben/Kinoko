import type { I18nService } from '../../core/i18n/i18n.service';

/** Translates the name of a role. A custom role has a free name, not a text key. */
export function roleName(i18n: I18nService, name: string): string {
  return i18n.translateOptional(name);
}

/** The fields of a role that give its description. */
interface Described {
  readonly slug: string;
  readonly builtIn: boolean;
  readonly description?: string | null;
}

/** The description of a role. A built-in role without its own text has the text `admin.role.about.<slug>`. */
export function roleAbout(i18n: I18nService, role: Described): string {
  const own = role.description ?? '';
  if (own !== '' || !role.builtIn) return own;
  const key = `admin.role.about.${role.slug}`;
  const text = i18n.translateOptional(key);
  return text === key ? '' : text;
}
