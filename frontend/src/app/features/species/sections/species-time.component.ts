import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { RowGroupComponent } from '../../../ui/row-group/row-group.component';
import { SectionComponent } from '../../../ui/section/section.component';
import type { SpeciesEntry } from '../../../core/api/models';
import { MONTH_TEXT } from '../labels';
import { SpeciesSeasonComponent } from './species-season.component';

/** The fruiting period of a species per `SpeciesSections.dc.html`: a row with the months, the season curve below. */
@Component({
  selector: 'app-species-time',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, RowGroupComponent, SectionComponent, SpeciesSeasonComponent, TranslatePipe],
  templateUrl: './species-time.component.html',
  styleUrl: './species-time.component.scss',
})
export class SpeciesTimeComponent {
  private readonly i18n = inject(I18nService);

  readonly species = input.required<SpeciesEntry>();

  protected readonly slug = computed(() => this.species().slug);

  protected readonly period = computed(() => {
    const held = this.species();
    const from = held.periodStartMonth ?? null;
    const to = held.periodEndMonth ?? null;
    if (from === null || to === null) return null;
    return {
      text: this.i18n.translate('species.period.range', {
        von: this.i18n.translate(MONTH_TEXT[from - 1]),
        bis: this.i18n.translate(MONTH_TEXT[to - 1]),
      }),
    };
  });
}
