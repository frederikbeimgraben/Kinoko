import { photoPath, type SpeciesEntry } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { SpeciesPickerEntry } from '../../ui/species-picker/species-picker.component';
import { EDIBILITY_TEXT, EDIBILITY_TONE } from '../species/labels';
import { aliasOf } from '../species/species-names';

/** A species as an entry of the species picker of the map. */
export function speciesChoice(species: SpeciesEntry, i18n: I18nService): SpeciesPickerEntry {
  return {
    value: species.slug,
    name: species.name,
    latin: species.scientificName,
    alias: aliasOf(species),
    levelText: i18n.translate(EDIBILITY_TEXT[species.edibility]),
    levelColour: EDIBILITY_TONE[species.edibility].colour,
    levelBackground: EDIBILITY_TONE[species.edibility].background,
    image: species.leadPhotoId ? photoPath(species.leadPhotoId, 'list') : null,
  };
}
