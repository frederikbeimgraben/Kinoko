import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LevelPillComponent } from '../../../ui/level-pill/level-pill.component';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { RowGroupComponent } from '../../../ui/row-group/row-group.component';
import { SectionComponent } from '../../../ui/section/section.component';
import type { SpeciesEntry } from '../../../core/api/models';
import { DEFAULT_LOCALE } from '../../../core/i18n/translations';
import { GermanHintComponent } from './german-hint.component';
import { EDIBILITY_TEXT, EDIBILITY_TONE, MUTED_TONE, PROTECTION_TEXT } from '../labels';

/** A rating badge: text and colours. */
export interface Level {
  text: string;
  colour: string;
  background: string;
}

/** The rating of a species: edibility, protection and trade. */
@Component({
  selector: 'app-species-features',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    GermanHintComponent,
    LevelPillComponent,
    ListRowComponent,
    RowGroupComponent,
    SectionComponent,
    TranslatePipe,
  ],
  templateUrl: './species-features.component.html',
  styleUrl: './species-features.component.scss',
})
export class SpeciesFeaturesComponent {
  private readonly i18n = inject(I18nService);

  readonly species = input.required<SpeciesEntry>();
  /** The note on edibility is a German catalogue text. */
  protected readonly catalogueLang = DEFAULT_LOCALE;

  protected readonly edibility = computed<Level>(() => {
    const held = this.species();
    return { text: this.i18n.translate(EDIBILITY_TEXT[held.edibility]), ...EDIBILITY_TONE[held.edibility] };
  });

  protected readonly protection = computed<Level>(() => ({
    text: this.i18n.translate(PROTECTION_TEXT[this.species().protection]),
    ...MUTED_TONE,
  }));

  protected readonly trade = computed<Level>(() => ({
    text: this.i18n.translate(
      this.species().marketable === true ? 'species.value.tradeAllowed' : 'species.value.tradeLimited',
    ),
    ...MUTED_TONE,
  }));
}
