import type { ColourChange, Speed, SpeciesEntry, TriggerGroup } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';

export const TRIGGER_GROUPS: readonly TriggerGroup[] = ['mechanical', 'reagent', 'environment'];

export const TRIGGER_GROUP_TEXT: Readonly<Record<TriggerGroup, TranslationKey>> = {
  mechanical: 'enum.trigger_group.mechanical',
  reagent: 'enum.trigger_group.reagent',
  environment: 'enum.trigger_group.environment',
};

export const SPEEDS: readonly Speed[] = ['permanent', 'immediate', '30s', '1min', '3min', 'longer'];

/** Die Verfärbung an ihrer Stelle, sofern die Art sie trägt. */
export function changeAt(species: SpeciesEntry | null, at: number): ColourChange | null {
  return species?.colourChanges[at] ?? null;
}
