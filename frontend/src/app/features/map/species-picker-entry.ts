import type { SpeciesBrief } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { ForecastSlug } from '../../core/tiles/tile-paths';
import { EDIBILITY_COLOUR, EDIBILITY_TEXT } from '../species/labels';
import type { SeasonSeries } from '../../ui/season-curve/season-curve.component';
import { type SpeciesPickerEntry } from '../../ui/species-picker/species-picker.component';

/** Die Begehungen des Katalogs, der Nenner beider Reihen. */
export interface CatalogueVisits {
  readonly allYears: readonly number[];
  readonly currentYear: readonly number[];
}

/** Eine Zeile der Kartenwahl, mit ihrer Saisonkurve für den Hinten-Slot. */
export interface MapSpeciesPickerEntry extends SpeciesPickerEntry {
  readonly series: readonly SeasonSeries[];
  readonly curveLabel: string;
}

/** Wandelt eine Art mit Kartenschlüssel in eine Zeile für `app-species-picker`. */
export function mapSpeciesPickerEntry(
  art: SpeciesBrief,
  slug: ForecastSlug,
  visits: CatalogueVisits,
  i18n: I18nService,
): MapSpeciesPickerEntry {
  return {
    value: slug,
    name: art.name,
    latin: art.lateinisch,
    levelText: i18n.translate(EDIBILITY_TEXT[art.speisewert]),
    levelColour: EDIBILITY_COLOUR[art.speisewert],
    image: art.titelbild,
    series: [
      { shape: 'area', values: art.saison?.alleJahre ?? [], visits: visits.allYears },
      { shape: 'line', values: art.saison?.laufendesJahr ?? [], visits: visits.currentYear },
    ],
    curveLabel: i18n.translate('saison.beschriftung'),
  };
}
