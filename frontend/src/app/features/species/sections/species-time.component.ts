import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { YearBandComponent } from '../../../ui/year-band/year-band.component';
import type { SpeciesEntry } from '../../../core/api/models';
import { MONTH_TEXT } from '../labels';

/** Die vier Marken unter dem Jahresband. */
const MARKS = [MONTH_TEXT[0], MONTH_TEXT[3], MONTH_TEXT[6], MONTH_TEXT[9]];

const SHORT = 3;

/** Die Wachstumszeit einer Art als Jahresband. */
@Component({
  selector: 'app-species-time',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, YearBandComponent],
  templateUrl: './species-time.component.html',
  styleUrl: './species-time.component.scss',
})
export class SpeciesTimeComponent {
  private readonly i18n = inject(I18nService);

  readonly species = input.required<SpeciesEntry>();

  protected readonly period = computed(() => {
    const held = this.species();
    const from = held.periodStartMonth ?? null;
    const to = held.periodEndMonth ?? null;
    if (from === null || to === null) return null;
    return {
      from,
      to,
      text: this.i18n.translate('species.period.range', {
        von: this.i18n.translate(MONTH_TEXT[from - 1]),
        bis: this.i18n.translate(MONTH_TEXT[to - 1]),
      }),
    };
  });

  protected readonly marks = computed(() =>
    MARKS.map((month) => this.i18n.translate(month).slice(0, SHORT)),
  );
}
