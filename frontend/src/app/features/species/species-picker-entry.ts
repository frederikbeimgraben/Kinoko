import type { SpeciesSummary } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import { type SpeciesPickerEntry } from '../../ui/species-picker/species-picker.component';
import { EDIBILITY_TEXT, EDIBILITY_TONE } from './labels';

/** Wandelt eine Art des Katalogs in eine Zeile für `app-species-picker`. */
export function speciesPickerEntry(entry: SpeciesSummary, i18n: I18nService): SpeciesPickerEntry {
  const tone = EDIBILITY_TONE[entry.edibility];
  return {
    value: entry.slug,
    name: entry.name,
    latin: entry.scientificName,
    levelText: i18n.translate(EDIBILITY_TEXT[entry.edibility]),
    levelColour: tone.colour,
    levelBackground: tone.background,
  };
}
