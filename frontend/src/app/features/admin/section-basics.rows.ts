import type { SpeciesEntry, SpeciesWrite } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';

type Names = NonNullable<SpeciesWrite['names']>;
type NameKind = Names[number]['kind'];

/** The text key of an enum value, for example `enum.season.spring`. */
export function enumKey(set: string, value: string): TranslationKey {
  return `enum.${set}.${value}` as TranslationKey;
}

/** The names of one kind on one line, with commas between them. */
export function namesLine(species: SpeciesEntry | null, kind: NameKind): string {
  return (species?.names ?? [])
    .filter((one) => one.kind === kind)
    .map((one) => one.name)
    .join(', ');
}

function namesOf(line: string, kind: NameKind): Names {
  return line
    .split(',')
    .map((one) => one.trim())
    .filter((one) => one !== '')
    .map((name) => ({ name, kind }));
}

/** The other names from the two lines: first the common names, then the synonyms. */
export function namesFrom(common: string, synonyms: string): Names {
  return [...namesOf(common, 'common'), ...namesOf(synonyms, 'synonym')];
}

/** The chip value of a field that can be empty. */
export function chosen(value: string | null | undefined): string[] {
  return value === null || value === undefined ? [] : [value];
}
