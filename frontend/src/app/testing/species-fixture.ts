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

/** Eine Art mit allen Pflichtfeldern des Vertrags. */
export function speciesEntry(seed: Seed): SpeciesEntry {
  return {
    id: seed.slug,
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

export const SPECIES_BUNDLE: SpeciesBundle = { items: [PENNY_BUN, BAY_BOLETE, HEDGEHOG] };

/** Eine Art in Kurzform, so wie eine Stufe der Einordnung sie führt. */
export function speciesSummary(seed: SummarySeed): SpeciesSummary {
  return {
    id: seed.slug,
    group: 'bolete',
    edibility: 'edible',
    protection: 'none',
    forecastEnabled: true,
    updatedAt: '2026-09-06T00:00:00Z',
    ...seed,
  };
}

/** Eine Stufe der Einordnung mit Weg, Geschwistern, Kindern und Arten. */
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

/** Ein Schritt im Weg von oben nach unten. */
export function taxonStep(rank: TaxonRank, slug: string, name: string): TaxonStep {
  return { id: slug, rank, slug, name };
}
