import type { SpeciesBundle, SpeciesEntry } from '../core/api/models';

type Seed = Partial<SpeciesEntry> & Pick<SpeciesEntry, 'slug' | 'name' | 'scientificName'>;

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
