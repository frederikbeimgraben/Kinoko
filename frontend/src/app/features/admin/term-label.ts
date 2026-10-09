import type { TermKind } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';

/** The fields of a term that give its name. */
interface Named {
  readonly kind: TermKind;
  readonly slug: string;
  readonly name: string;
}

/** The name of a term in the UI language. German uses the catalogue name, so a rename shows at once.
 * Other languages use the text `term.<kind>.<slug>`. A term without that text keeps its catalogue name. */
export function termLabel(term: Named, i18n: Pick<I18nService, 'locale' | 'translateOptional'>): string {
  if (i18n.locale() === 'de') return term.name;
  const key = `term.${term.kind}.${term.slug}`;
  const text = i18n.translateOptional(key);
  return text === key || text === '' ? term.name : text;
}
