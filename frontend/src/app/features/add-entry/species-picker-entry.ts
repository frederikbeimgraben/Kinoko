import type { Level, SpeciesBrief } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import { type SpeciesPickerEntry } from '../../ui/species-picker/species-picker.component';

/** Der Text zur Stufe einer Art, für die Plakette in der Artenwahl. */
const LEVEL_TEXT_KEY: Record<Level, TranslationKey> = {
  vorhersage: 'art.tag.vorhersage',
  saison: 'art.tag.saison',
  profil: 'art.tag.profil',
};

/** Die Farbe zur Stufe, aus den Tokens der App. */
const LEVEL_COLOUR: Record<Level, string> = {
  vorhersage: 'var(--color-info)',
  saison: 'var(--color-accent)',
  profil: 'var(--color-primary)',
};

/** Wandelt eine Art des Katalogs in eine Zeile für `app-species-picker`. */
export function speciesPickerEntry(art: SpeciesBrief, i18n: I18nService): SpeciesPickerEntry {
  return {
    value: art.slug,
    name: art.name,
    latin: art.lateinisch,
    levelText: i18n.translate(LEVEL_TEXT_KEY[art.stufe]),
    levelColour: LEVEL_COLOUR[art.stufe],
    image: art.titelbild,
  };
}
