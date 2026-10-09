import type { I18nService } from '../../core/i18n/i18n.service';
import { type SpeciesPickerEntry } from '../../ui/species-picker/species-picker.component';
import { EDIBILITY_TEXT, EDIBILITY_TONE } from './labels';
import { aliasOf, type LocalSpecies } from './species-names';

/** Converts a catalogue species into an entry for `app-species-picker`. */
export function speciesPickerEntry(entry: LocalSpecies, i18n: I18nService): SpeciesPickerEntry {
  const tone = EDIBILITY_TONE[entry.edibility];
  return {
    value: entry.slug,
    name: entry.name,
    latin: entry.scientificName,
    alias: aliasOf(entry),
    levelText: i18n.translate(EDIBILITY_TEXT[entry.edibility]),
    levelColour: tone.colour,
    levelBackground: tone.background,
  };
}
