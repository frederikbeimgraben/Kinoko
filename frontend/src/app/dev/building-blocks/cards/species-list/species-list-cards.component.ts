import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { photoPath, type SpeciesEntry } from '../../../../core/api/models';
import { FactorRowComponent, type CombinationFactor } from '../../../../ui/factor-row/factor-row.component';
import {
  SpeciesRowComponent,
  type SpeciesRowSpecies,
} from '../../../../ui/species-row/species-row.component';
import { TimelineComponent, type TimelineWeek } from '../../../../ui/timeline/timeline.component';
import { factsOf } from '../../../../features/species/facets';
import { SpeciesColourComponent } from '../../../../features/species/filter-colour.component';
import { SpeciesFilterPanelComponent } from '../../../../features/species/filter-panel.component';
import { SpeciesFilterSheetComponent } from '../../../../features/species/filter-sheet.component';
import { SpeciesResultsComponent } from '../../../../features/species/species-results.component';
import { SpeciesFilterState } from '../../../../features/species/filter.state';
import { SpeciesState, type CatalogueEntry } from '../../../../features/species/species.state';
import { BlockCardComponent } from '../block-card/block-card.component';

/** Eine Art mit allen Pflichtfeldern des Vertrags, so knapp wie möglich. */
function entry(
  seed: Partial<SpeciesEntry> & Pick<SpeciesEntry, 'slug' | 'name' | 'scientificName'>,
): SpeciesEntry {
  return {
    id: seed.slug,
    genusName: seed.scientificName.split(' ')[0],
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

const WEEKS: readonly [number, number, boolean][] = [
  [35, 35, false],
  [36, 55, false],
  [37, 70, false],
  [38, 85, false],
  [39, 75, true],
  [40, 60, true],
];

/** Die Art- und Filter-Bausteine des D1-Batch 7, je ihre Vorgabe im Brett. */
@Component({
  selector: 'app-species-list-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlockCardComponent,
    FactorRowComponent,
    SpeciesColourComponent,
    SpeciesFilterPanelComponent,
    SpeciesFilterSheetComponent,
    SpeciesResultsComponent,
    SpeciesRowComponent,
    TimelineComponent,
    TranslatePipe,
  ],
  templateUrl: './species-list-cards.component.html',
})
export class SpeciesListCardsComponent {
  private readonly i18n = inject(I18nService);
  private readonly state = inject(SpeciesState);
  protected readonly filter = inject(SpeciesFilterState);

  protected readonly steinpilz: SpeciesRowSpecies = {
    name: this.i18n.translate('beispiel.steinpilz'),
    latin: 'Boletus edulis',
    levelText: this.i18n.translate('beispiel.essbar'),
    levelColour: 'var(--ok)',
    levelKind: 'ok',
    colour: '#7a5230',
    image: photoPath('art-stein', 'list'),
  };

  protected readonly hits: readonly CatalogueEntry[] = [
    entry({
      slug: 'steinpilz',
      name: this.i18n.translate('beispiel.steinpilz'),
      scientificName: 'Boletus edulis',
      leadPhotoId: 'art-stein',
    }),
    entry({
      slug: 'pfifferling',
      name: this.i18n.translate('beispiel.pfifferling'),
      scientificName: 'Cantharellus cibarius',
      leadPhotoId: 'art-pfifferling',
    }),
  ].map((species) => ({ species, facts: factsOf(species, []) }));

  protected readonly weeks: readonly TimelineWeek[] = WEEKS.map(([week, fill, forecast]) => ({
    year: 2026,
    week,
    share: fill / 100,
    forecast,
  }));

  protected readonly factor: CombinationFactor = {
    name: this.i18n.translate('map.factor.precipitation'),
    range: this.i18n.translate('beispiel.summeKw'),
    condition: '≥ 80 mm',
  };

  constructor() {
    void this.state.loadBundle();
  }
}
