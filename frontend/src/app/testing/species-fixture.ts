import { factsOf } from '../features/species/facets';
import type {
  SpeciesBundle,
  SpeciesEntry,
  SpeciesSummary,
  TaxonPage,
  TaxonRank,
  TaxonStep,
} from '../core/api/models';

type Seed = Partial<SpeciesEntry> & Pick<SpeciesEntry, 'slug' | 'name' | 'scientificName'>;

type SummarySeed = Partial<SpeciesSummary> & Pick<SpeciesSummary, 'slug' | 'name' | 'scientificName'>;

type PageSeed = Partial<TaxonPage> & Pick<TaxonPage, 'slug' | 'name' | 'rank'>;

/** A species with all required contract fields. */
export function speciesEntry(seed: Seed): SpeciesEntry {
  return {
    id: seed.slug,
    genusName: seed.scientificName.split(' ')[0],
    group: 'bolete',
    edibility: 'edible',
    protection: 'none',
    forecastEnabled: true,
    updatedAt: '2026-09-06T00:00:00Z',
    names: [],
    measurements: [],
    colours: [],
    colourChanges: [],
    capFeatures: [],
    capMargins: [],
    stemFeatures: [],
    traits: [],
    sources: [],
    seasons: [],
    terms: [],
    lookalikes: [],
    ...seed,
  };
}

export const PENNY_BUN = speciesEntry({
  slug: 'steinpilz',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
});

export const BAY_BOLETE = speciesEntry({
  slug: 'maronenroehrling',
  name: 'Maronenröhrling',
  scientificName: 'Imleria badia',
});

export const HEDGEHOG = speciesEntry({
  slug: 'semmelstoppelpilz',
  name: 'Semmelstoppelpilz',
  scientificName: 'Hydnum repandum',
  group: 'hedgehog',
  forecastEnabled: false,
});

/** The twelve standard colours of the bundle. */
export const PALETTE: SpeciesBundle['standardColours'] = [
  { key: 'white', hex: '#f3efe6' },
  { key: 'cream', hex: '#e8d9b5' },
  { key: 'yellow', hex: '#e0b446' },
  { key: 'orange', hex: '#d1832f' },
  { key: 'redBrown', hex: '#a0522d' },
  { key: 'brown', hex: '#6b4423' },
  { key: 'darkBrown', hex: '#3e2a17' },
  { key: 'olive', hex: '#7f8a3a' },
  { key: 'green', hex: '#4f7a3a' },
  { key: 'red', hex: '#b8322a' },
  { key: 'violet', hex: '#7a3b6a' },
  { key: 'grey', hex: '#8a8f8a' },
];

/** Counts the catalogue facets, as the service does. */
export function countAxes(items: readonly SpeciesEntry[]): SpeciesBundle['facets'] {
  const counts: Record<string, Record<string, number>> = {};
  const add = (axis: string, value: string): void => {
    counts[axis] = counts[axis] ?? {};
    counts[axis][value] = (counts[axis][value] ?? 0) + 1;
  };
  for (const entry of items) {
    const facts = factsOf(entry, PALETTE);
    for (const [axis, values] of facts.values) {
      if (values.length > 0) for (const value of values) add(axis, value);
      else if (axis !== 'forecast') add('unknown', axis);
    }
    for (const [part, keys] of facts.colours) {
      for (const key of keys) add(`colour.${part}`, key);
    }
  }
  return counts;
}

export function speciesBundle(
  items: readonly SpeciesEntry[],
  facets: SpeciesBundle['facets'] = countAxes(items),
): SpeciesBundle {
  return { items: [...items], standardColours: PALETTE, facets };
}

export const SPECIES_BUNDLE: SpeciesBundle = speciesBundle([PENNY_BUN, BAY_BOLETE, HEDGEHOG]);

/** A short species entry, as a taxon page lists it. */
export function speciesSummary(seed: SummarySeed): SpeciesSummary {
  return {
    id: seed.slug,
    genusName: seed.scientificName.split(' ')[0],
    group: 'bolete',
    edibility: 'edible',
    protection: 'none',
    forecastEnabled: true,
    updatedAt: '2026-09-06T00:00:00Z',
    ...seed,
  };
}

/** A taxon page with path, siblings, children and species. */
export function taxonPage(seed: PageSeed): TaxonPage {
  return {
    id: seed.slug,
    path: [],
    siblings: [],
    children: [],
    species: [],
    speciesCount: 0,
    ...seed,
  };
}

/** One step in the path from top to bottom. */
export function taxonStep(rank: TaxonRank, slug: string, name: string): TaxonStep {
  return { id: slug, rank, slug, name };
}
