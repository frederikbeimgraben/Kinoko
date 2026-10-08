import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { photoPath, type ColourGroup, type Lookalike, type SpeciesEntry } from '../../../../core/api/models';
import { HeroComponent, type HeroPhoto } from '../../../../ui/hero/hero.component';
import {
  MeasurementGroupComponent,
  type MeasurementRow,
} from '../../../../ui/measurement-group/measurement-group.component';
import { PhotoStripComponent, type StripPhoto } from '../../../../ui/photo-strip/photo-strip.component';
import { SectionComponent } from '../../../../ui/section/section.component';
import { SpeciesColoursComponent } from '../../../../features/species/sections/species-colours.component';
import { SpeciesFeaturesComponent } from '../../../../features/species/sections/species-features.component';
import { SpeciesLookalikesComponent } from '../../../../features/species/sections/species-lookalikes.component';
import { SpeciesTaxonomyComponent } from '../../../../features/species/sections/species-taxonomy.component';
import { BlockCardComponent } from '../block-card/block-card.component';

/** A species skeleton with the required contract fields. All other fields are empty. */
function baseSpecies(overrides: Partial<SpeciesEntry> & Pick<SpeciesEntry, 'slug' | 'name'>): SpeciesEntry {
  return {
    id: overrides.slug,
    scientificName: '',
    genusName: '',
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
    ...overrides,
  };
}

/** The four color rows that `ColourSection.dc.html` shows for the porcini. */
function boletusColours(i18n: I18nService): readonly ColourGroup[] {
  return [
    {
      part: 'cap',
      mode: 'distinct',
      colours: [
        { name: i18n.translate('beispiel.farbeWeiss'), hex: '#f2efe6' },
        { name: i18n.translate('beispiel.farbeBraun'), hex: '#7a5230' },
      ],
    },
    {
      part: 'stem',
      mode: 'gradient',
      colours: [
        { name: i18n.translate('beispiel.farbeCremeweiss'), hex: '#f2e8d5' },
        { name: i18n.translate('beispiel.farbeOcker'), hex: '#c9a877' },
      ],
    },
    {
      part: 'flesh',
      mode: 'distinct',
      colours: [
        { name: i18n.translate('beispiel.farbeWeiss'), hex: '#f2efe6' },
        { name: i18n.translate('beispiel.farbeRot'), hex: '#c0392b' },
      ],
    },
    {
      part: 'spore_print',
      mode: 'single',
      colours: [{ name: i18n.translate('beispiel.farbeOlivbraun'), hex: '#6d6332' }],
    },
  ];
}

/** Two measurement groups, as `SizeSection.dc.html` shows them for the porcini. */
const CAP_MEASURES: readonly MeasurementRow[] = [
  { extent: 'width', spans: [{ from: 4, to: 20 }], unit: 'cm' },
];
const SPORE_MEASURES: readonly MeasurementRow[] = [
  { extent: 'length', spans: [{ from: 12.4, to: 19.2 }], unit: 'µm' },
  { extent: 'width', spans: [{ from: 4.5, to: 5.5 }], unit: 'µm' },
];

/** The three lookalikes, as `LookalikeSection.dc.html` shows them for the porcini. */
function boletusLookalikes(i18n: I18nService): readonly Lookalike[] {
  return [
    {
      slug: 'gallenroehrling',
      name: i18n.translate('beispiel.gallenroehrling'),
      scientificName: 'Tylopilus felleus',
      edibility: 'inedible',
      capColours: [{ name: i18n.translate('beispiel.farbeBraun'), hex: '#8a6a4a' }],
      difference: i18n.translate('beispiel.verwechslungshinweis'),
    },
    {
      slug: 'maronenroehrling',
      name: i18n.translate('beispiel.maronenroehrling'),
      scientificName: 'Imleria badia',
      edibility: 'edible',
      capColours: [{ name: i18n.translate('beispiel.farbeBraun'), hex: '#5a3220' }],
      difference: i18n.translate('beispiel.unterscheidungMaronen'),
    },
    {
      slug: 'sommersteinpilz',
      name: i18n.translate('beispiel.sommersteinpilz'),
      scientificName: 'Boletus reticulatus',
      edibility: 'edible',
      capColours: [{ name: i18n.translate('beispiel.farbeOcker'), hex: '#a07a4a' }],
      difference: i18n.translate('beispiel.unterscheidungSommer'),
    },
  ];
}

/** A photo, as the hero card of the board shows it. */
function heroPhoto(): HeroPhoto {
  return { path: photoPath('bild-eins', 'full'), photographer: 'Marie Weber', licence: 'cc_by_sa_4' };
}

/** The species page cards: hero, rating, taxonomy, sizes, colors, lookalikes and photos. */
@Component({
  selector: 'app-species-page-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlockCardComponent,
    HeroComponent,
    MeasurementGroupComponent,
    PhotoStripComponent,
    SectionComponent,
    SpeciesColoursComponent,
    SpeciesFeaturesComponent,
    SpeciesLookalikesComponent,
    SpeciesTaxonomyComponent,
    TranslatePipe,
  ],
  templateUrl: './species-page-cards.component.html',
  styleUrl: './species-page-cards.component.scss',
})
export class SpeciesPageCardsComponent {
  private readonly i18n = inject(I18nService);

  protected readonly heroPhoto = heroPhoto();

  protected readonly ratingSpecies = baseSpecies({
    slug: 'boletus-edulis',
    name: this.i18n.translate('beispiel.steinpilz'),
    edibility: 'edible',
    protection: 'personal_use',
    marketable: true,
  });

  protected readonly taxonSpecies = baseSpecies({
    slug: 'boletus-edulis',
    name: this.i18n.translate('beispiel.steinpilz'),
    scientificName: 'Boletus edulis',
    genusName: 'Boletus',
    familyName: 'Boletaceae',
  });

  protected readonly capMeasures = CAP_MEASURES;
  protected readonly sporeMeasures = SPORE_MEASURES;

  protected readonly colourGroups = boletusColours(this.i18n);

  protected readonly lookalikes = boletusLookalikes(this.i18n);

  protected readonly stripPhotos: readonly StripPhoto[] = [
    { id: 'bild-eins', path: photoPath('bild-eins', 'list') },
    { id: 'bild-zwei', path: photoPath('bild-zwei', 'list') },
  ];
}
