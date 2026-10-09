import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { SpeciesEntry } from '../../../core/api/models';
import type { TranslationKey } from '../../../core/i18n/translations';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { RowGroupComponent } from '../../../ui/row-group/row-group.component';
import { SectionComponent } from '../../../ui/section/section.component';
import { DEFAULT_LOCALE } from '../../../core/i18n/translations';
import { stemFeatureList } from '../stem-features';
import { GermanHintComponent } from './german-hint.component';

/** The trait texts of the catalogue in the order of the body, then the habitat. The colours section shows the spore print. */
const PARTS: readonly { key: string; titleKey: TranslationKey }[] = [
  { key: 'fruitbody', titleKey: 'species.field.fruitbody' },
  { key: 'cap', titleKey: 'species.field.cap' },
  { key: 'gills', titleKey: 'species.field.gills' },
  { key: 'folds', titleKey: 'species.field.folds' },
  { key: 'tubes', titleKey: 'species.field.tubes' },
  { key: 'pores', titleKey: 'species.field.pores' },
  { key: 'spines', titleKey: 'species.field.spines' },
  { key: 'stem', titleKey: 'species.field.stem' },
  { key: 'flesh', titleKey: 'species.field.flesh' },
  { key: 'milk', titleKey: 'species.field.milk' },
  { key: 'habitat', titleKey: 'species.field.habitat' },
];

/** A body part with its catalogue sentence. Only the stem features are in the language of the page. */
interface Trait {
  titleKey: TranslationKey;
  text: string;
  lang: string | null;
}

/** The traits of a species per `SpeciesSections.dc.html`: one group, a row for each part with its sentence. */
@Component({
  selector: 'app-species-traits',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GermanHintComponent, ListRowComponent, RowGroupComponent, SectionComponent, TranslatePipe],
  templateUrl: './species-traits.component.html',
  styleUrl: './species-traits.component.scss',
})
export class SpeciesTraitsComponent {
  private readonly i18n = inject(I18nService);

  readonly species = input.required<SpeciesEntry>();

  protected readonly traits = computed<Trait[]>(() => {
    const held = this.species();
    const sentences = PARTS.map((part) => ({
      titleKey: part.titleKey,
      text: held.traits.find((one) => one.key === part.key)?.text ?? '',
      lang: DEFAULT_LOCALE,
    }));
    const features: Trait = {
      titleKey: 'species.field.stemFeatures',
      text: stemFeatureList(held, this.i18n),
      lang: null,
    };
    const afterStem = sentences.findIndex((trait) => trait.titleKey === 'species.field.stem') + 1;
    return [...sentences.slice(0, afterStem), features, ...sentences.slice(afterStem)].filter(
      (trait) => trait.text !== '',
    );
  });

  /** The hint shows only above German sentences. */
  protected readonly german = computed(() => this.traits().some((trait) => trait.lang !== null));
}
