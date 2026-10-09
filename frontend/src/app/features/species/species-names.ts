import type { SpeciesEntry } from '../../core/api/models';
import { DEFAULT_LOCALE } from '../../core/i18n/translations';

/** A species with its names in the language of the interface. The catalogue has German names only, so
 * another language shows the scientific name, which every reader knows. The German name stays a common
 * name, so that the search still finds it. */
export function localSpecies(one: SpeciesEntry, locale: string): SpeciesEntry {
  if (locale === DEFAULT_LOCALE) return one;
  return {
    ...one,
    name: one.scientificName,
    names: [{ kind: 'common', name: one.name }, ...one.names.filter((other) => other.name !== one.name)],
    lookalikes: one.lookalikes.map((lookalike) => ({ ...lookalike, name: lookalike.scientificName })),
  };
}
