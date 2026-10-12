import type { TraitEntry, TraitKey } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';

/** The trait texts that belong to no body part. The part pages write the others. */
export const TEXT_TRAITS: readonly { key: TraitKey; title: TranslationKey }[] = [
  { key: 'habitat', title: 'species.field.habitat' },
  { key: 'season', title: 'species.section.period' },
  { key: 'folds', title: 'species.field.folds' },
  { key: 'spines', title: 'species.field.spines' },
  { key: 'milk', title: 'species.field.milk' },
  { key: 'smell', title: 'species.field.smell' },
  { key: 'taste', title: 'species.field.taste' },
  { key: 'reagents', title: 'admin.species.trait.reagents' },
  { key: 'edibility', title: 'species.field.edibility' },
  { key: 'protection', title: 'species.field.protection' },
];

/** Puts the texts into the traits. An empty text removes its trait; the other traits stay. */
export function withTexts(
  traits: readonly TraitEntry[],
  texts: Readonly<Record<string, string>>,
): TraitEntry[] {
  const keys = new Set<string>(TEXT_TRAITS.map((one) => one.key));
  const others = traits.filter((one) => !keys.has(one.key));
  const written = TEXT_TRAITS.filter((one) => (texts[one.key] ?? '').trim() !== '').map((one) => ({
    key: one.key,
    text: texts[one.key].trim(),
  }));
  return [...others, ...written];
}
