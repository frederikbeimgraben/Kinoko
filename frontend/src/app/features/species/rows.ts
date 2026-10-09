import { photoPath, type Edibility, type SpeciesEntry } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { SpeciesRowSpecies } from '../../ui/species-row/species-row.component';
import { judge, type Selection } from './facets';
import { aliasOf, type LocalSpecies } from './species-names';
import type { SpeciesSort } from './filter.store';
import { EDIBILITY_KIND, EDIBILITY_TEXT, EDIBILITY_TONE, MONTH_TEXT } from './labels';
import type { CatalogueEntry } from './species.store';
import type { StandardColour } from '../../core/api/models';

const FALLBACK_COLOUR = '#7a5230';

/** The order of the edibility sort: the safe species first. */
const EDIBILITY_ORDER: readonly Edibility[] = [
  'edible',
  'conditionally_edible',
  'inedible',
  'poisonous',
  'deadly',
];

/** A month after December puts a species without a season at the end. */
const NO_MONTH = 13;

/** The base colour of the species for the fallback icon of the thumb. */
export function leadColour(entry: SpeciesEntry): string {
  return entry.colours.find((group) => group.part === 'cap')?.colours[0]?.hex ?? FALLBACK_COLOUR;
}

/** Makes a row from a species. The row has exactly one badge, and a map mark when the species has a forecast. */
export function speciesRow(entry: LocalSpecies, i18n: I18nService): SpeciesRowSpecies {
  const tone = EDIBILITY_TONE[entry.edibility];
  return {
    name: entry.name,
    latin: entry.scientificName,
    alias: aliasOf(entry),
    levelText: i18n.translate(EDIBILITY_TEXT[entry.edibility]),
    levelColour: tone.colour,
    levelBackground: tone.background,
    levelKind: EDIBILITY_KIND[entry.edibility],
    colour: leadColour(entry),
    image: entry.leadPhotoId ? photoPath(entry.leadPhotoId, 'list') : null,
    forecastLabel: entry.forecastEnabled ? i18n.translate('species.forecast.mark') : undefined,
  };
}

/** True when the name, the Latin name or one more name of the species has the search text. */
export function matches(entry: SpeciesEntry, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === '') return true;
  return [entry.name, entry.scientificName, ...entry.names.map((one) => one.name)].some((name) =>
    name.toLocaleLowerCase().includes(needle),
  );
}

/** Searches the names of the species on the device: German, Latin, common names and synonyms. */
export function search(entries: readonly CatalogueEntry[], query: string): readonly CatalogueEntry[] {
  return query.trim() === '' ? entries : entries.filter((one) => matches(one.species, query));
}

/** Numbers in a name sort by their value, so "Art 2" comes before "Art 10". */
const byName = (one: SpeciesEntry, other: SpeciesEntry): number =>
  one.name.localeCompare(other.name, 'de', { numeric: true });

/** The comparison of each sort. Equal species keep the order of their names. */
const ORDER: Readonly<Record<SpeciesSort, (one: SpeciesEntry, other: SpeciesEntry) => number>> = {
  name: byName,
  latin: (one, other) => one.scientificName.localeCompare(other.scientificName, 'la'),
  edibility: (one, other) =>
    EDIBILITY_ORDER.indexOf(one.edibility) - EDIBILITY_ORDER.indexOf(other.edibility) || byName(one, other),
  season: (one, other) =>
    (one.periodStartMonth ?? NO_MONTH) - (other.periodStartMonth ?? NO_MONTH) || byName(one, other),
};

/** A new list in the order of `sort`. */
export function sortEntries(entries: readonly CatalogueEntry[], sort: SpeciesSort): CatalogueEntry[] {
  return [...entries].sort((one, other) => ORDER[sort](one.species, other.species));
}

/** The first letter without its accent: "Ästiger Stachelbart" sorts with A, so it goes under A too. */
export function initialOf(name: string): string {
  return name.charAt(0).normalize('NFD').charAt(0).toLocaleUpperCase();
}

/** The head above a group of rows in the order of `sort`. An empty head starts no group. */
export function headOf(entry: SpeciesEntry, sort: SpeciesSort, i18n: I18nService): string {
  switch (sort) {
    case 'name':
      return initialOf(entry.name);
    case 'latin':
      return initialOf(entry.scientificName);
    case 'edibility':
      return i18n.translate(EDIBILITY_TEXT[entry.edibility]);
    case 'season': {
      const month = entry.periodStartMonth;
      return month == null ? '' : i18n.translate(MONTH_TEXT[month - 1]);
    }
  }
}

/** The species that match the search and the filter, and the species without the data to judge. */
export interface Listing {
  readonly hits: readonly CatalogueEntry[];
  readonly unknown: readonly CatalogueEntry[];
}

/** Searches, judges and sorts the catalogue in one pass. */
export function listing(
  entries: readonly CatalogueEntry[],
  query: string,
  selection: Selection,
  palette: readonly StandardColour[],
  sort: SpeciesSort,
): Listing {
  const found = search(entries, query).map((one) => ({ one, verdict: judge(one.facts, selection, palette) }));
  const pick = (verdict: string): CatalogueEntry[] =>
    sortEntries(
      found.filter((held) => held.verdict === verdict).map((held) => held.one),
      sort,
    );
  return { hits: pick('hit'), unknown: pick('unknown') };
}
