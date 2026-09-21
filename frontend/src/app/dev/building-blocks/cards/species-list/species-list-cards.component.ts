import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import type { WorkshopKey } from '../../../../core/i18n/workshop-texts';
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

/** Die Hutfarbe einer Art, in der Form des Vertrags. */
function capColour(hex: string): SpeciesEntry['colours'] {
  return [{ part: 'cap', mode: 'single', colours: [{ name: hex, hex }] }];
}

/** Neun der zehn Arten des Bretts `SpeciesList.dc.html`, in seiner Reihenfolge. */
const LIST_SPECIES: readonly {
  slug: string;
  name: WorkshopKey;
  latin: string;
  edibility: SpeciesEntry['edibility'];
  hex: string;
  photo?: string;
}[] = [
  {
    slug: 'tylopilus-felleus',
    name: 'beispiel.gallenroehrling',
    latin: 'Tylopilus felleus',
    edibility: 'inedible',
    hex: '#8a6a4a',
  },
  {
    slug: 'amanita-phalloides',
    name: 'beispiel.knollenblaetterpilz',
    latin: 'Amanita phalloides',
    edibility: 'deadly',
    hex: '#5d6b2f',
    photo: 'art-stein-hell',
  },
  {
    slug: 'imleria-badia',
    name: 'beispiel.maronenroehrling',
    latin: 'Imleria badia',
    edibility: 'edible',
    hex: '#5a3220',
    photo: 'art-marone',
  },
  {
    slug: 'amanita-pantherina',
    name: 'beispiel.pantherpilz',
    latin: 'Amanita pantherina',
    edibility: 'poisonous',
    hex: '#6b5236',
  },
  {
    slug: 'amanita-rubescens',
    name: 'beispiel.perlpilz',
    latin: 'Amanita rubescens',
    edibility: 'edible',
    hex: '#b97f72',
  },
  {
    slug: 'cantharellus-cibarius',
    name: 'beispiel.pfifferling',
    latin: 'Cantharellus cibarius',
    edibility: 'edible',
    hex: '#b9832a',
    photo: 'art-pfifferling',
  },
  {
    slug: 'hydnum-repandum',
    name: 'beispiel.semmelstoppelpilz',
    latin: 'Hydnum repandum',
    edibility: 'edible',
    hex: '#a9825a',
  },
  {
    slug: 'boletus-edulis',
    name: 'beispiel.steinpilz',
    latin: 'Boletus edulis',
    edibility: 'edible',
    hex: '#7a5230',
    photo: 'art-stein',
  },
  {
    slug: 'agaricus-campestris',
    name: 'beispiel.wiesenchampignon',
    latin: 'Agaricus campestris',
    edibility: 'edible',
    hex: '#e6e0cf',
  },
];

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

  protected readonly hits: readonly CatalogueEntry[] = LIST_SPECIES.map((one) =>
    entry({
      slug: one.slug,
      name: this.i18n.translate(one.name),
      scientificName: one.latin,
      edibility: one.edibility,
      colours: capColour(one.hex),
      ...(one.photo === undefined ? {} : { leadPhotoId: one.photo }),
    }),
  ).map((species) => ({ species, facts: factsOf(species, []) }));

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
