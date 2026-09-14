import type { TranslationKey } from '../../core/i18n/translations';
import type { TaxonRank } from '../../core/api/models';

export const RANK_TEXT: Record<TaxonRank, TranslationKey> = {
  division: 'species.taxonomy.division',
  class: 'species.taxonomy.class',
  order: 'species.taxonomy.order',
  family: 'species.taxonomy.family',
  genus: 'species.taxonomy.genus',
};

export const CHILDREN_TEXT: Record<TaxonRank, TranslationKey> = {
  division: 'species.taxonomy.children.division',
  class: 'species.taxonomy.children.class',
  order: 'species.taxonomy.children.order',
  family: 'species.taxonomy.children.family',
  genus: 'species.taxonomy.children.genus',
};

export const SPECIES_OF_TEXT: Record<TaxonRank, TranslationKey> = {
  division: 'species.taxonomy.speciesOf.division',
  class: 'species.taxonomy.speciesOf.class',
  order: 'species.taxonomy.speciesOf.order',
  family: 'species.taxonomy.speciesOf.family',
  genus: 'species.taxonomy.speciesOf.genus',
};
