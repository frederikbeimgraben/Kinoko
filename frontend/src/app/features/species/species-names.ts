import type { SpeciesEntry } from '../../core/api/models';
import { DEFAULT_LOCALE } from '../../core/i18n/translations';

/** A species in the language of the interface. `alias` is the German name where the Latin name is the title. */
export type LocalSpecies = SpeciesEntry & { readonly alias?: string };

/** The two lines of a species name everywhere in the app. German: German name, then the Latin name.
 * Another language: the catalogue has no names in it, so the Latin name is the title and the German name follows. */
export interface NameLines {
  readonly title: string;
  /** The Latin name under the title, or empty where the title is the Latin name. */
  readonly latin: string;
  /** The German name under the Latin title, or empty in German. */
  readonly alias: string;
}

/** The name lines of a species from its German and its Latin name. */
export function nameLines(name: string, scientificName: string, locale: string): NameLines {
  if (locale === DEFAULT_LOCALE || name === scientificName) {
    return { title: name, latin: name === scientificName ? '' : scientificName, alias: '' };
  }
  return { title: scientificName, latin: '', alias: name };
}

/** A species with its names in the language of the interface, per {@link nameLines}. The German name stays a
 * common name, so that the search still finds it. */
export function localSpecies(one: SpeciesEntry, locale: string): LocalSpecies {
  if (locale === DEFAULT_LOCALE) return one;
  return {
    ...one,
    name: one.scientificName,
    alias: nameLines(one.name, one.scientificName, locale).alias,
    names: [{ kind: 'common', name: one.name }, ...one.names.filter((other) => other.name !== one.name)],
    lookalikes: one.lookalikes.map((lookalike) => ({ ...lookalike, name: lookalike.scientificName })),
  };
}

/** The German name under the Latin title of a local species, or empty. */
export function aliasOf(one: LocalSpecies): string {
  return one.alias ?? '';
}
