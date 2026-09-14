import type { SpeciesBrief } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { ForecastSlug } from '../../core/tiles/tile-paths';
import { EDIBILITY_COLOUR, EDIBILITY_TEXT } from '../species/labels';
import { type SpeciesPickerEntry } from '../../ui/species-picker/species-picker.component';

/** Eine Zeile der Kartenwahl, mit ihrer Saisonkurve für den Hinten-Slot. */
export interface MapSpeciesPickerEntry extends SpeciesPickerEntry {
  readonly curve: readonly number[];
  readonly current: readonly number[];
  readonly curveLabel: string;
}

/** Wandelt eine Art mit Kartenschlüssel in eine Zeile für `app-species-picker`. */
export function mapSpeciesPickerEntry(
  art: SpeciesBrief,
  slug: ForecastSlug,
  i18n: I18nService,
): MapSpeciesPickerEntry {
  return {
    value: slug,
    name: art.name,
    latin: art.lateinisch,
    levelText: i18n.translate(EDIBILITY_TEXT[art.speisewert]),
    levelColour: EDIBILITY_COLOUR[art.speisewert],
    image: art.titelbild,
    curve: art.saison?.alleJahre ?? [],
    current: art.saison?.laufendesJahr ?? [],
    curveLabel: i18n.translate('saison.beschriftung'),
  };
}
