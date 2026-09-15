import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { RangeSliderComponent } from '../../ui/range-slider/range-slider.component';
import { YearBandInputComponent } from '../../ui/year-band-input/year-band-input.component';
import { sizeKey } from './facets';
import { SpeciesFilterState } from './filter.state';
import { MONTH_TEXT } from './labels';
import { SpeciesState } from './species.state';

const CAP_WIDTH = sizeKey('cap', 'width');
const STEP = 30;
const FIRST_MONTH = 1;
const LAST_MONTH = 12;

/** Hutbreite als Spanne und die Wachstumszeit als Band im Jahr. */
@Component({
  selector: 'app-species-size',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RangeSliderComponent, TranslatePipe, YearBandInputComponent],
  templateUrl: './filter-size.component.html',
  styleUrl: './filter-size.component.scss',
})
export class SpeciesSizeComponent {
  private readonly state = inject(SpeciesState);
  private readonly i18n = inject(I18nService);
  protected readonly filter = inject(SpeciesFilterState);

  /** Die Skala endet an der breitesten Kappe im Katalog, auf zehn gerundet. */
  protected readonly max = computed(() => {
    const widest = this.state
      .entries()
      .reduce((high, one) => Math.max(high, one.facts.sizes.get(CAP_WIDTH)?.[1] ?? 0), 0);
    return Math.max(STEP, Math.ceil(widest / STEP) * STEP);
  });

  protected readonly middle = computed(() => this.max() / 2);

  protected readonly span = computed(() => this.filter.sizeOf(CAP_WIDTH) ?? [0, this.max()]);

  protected readonly months = computed(() => {
    const chosen = [...this.filter.chosenIn('period')].map(Number).sort((one, other) => one - other);
    if (chosen.length === 0) return [FIRST_MONTH, LAST_MONTH];
    return [chosen[0], chosen[chosen.length - 1]];
  });

  protected readonly periodText = computed(() =>
    this.i18n.translate('species.period.range', {
      von: this.i18n.translate(MONTH_TEXT[this.months()[0] - 1]),
      bis: this.i18n.translate(MONTH_TEXT[this.months()[1] - 1]),
    }),
  );

  protected setFrom(value: number): void {
    this.filter.setSize(CAP_WIDTH, [value, this.span()[1]]);
  }

  protected setTo(value: number): void {
    this.filter.setSize(CAP_WIDTH, [this.span()[0], value]);
  }

  protected setMonthFrom(month: number): void {
    this.setMonths(month, this.months()[1]);
  }

  protected setMonthTo(month: number): void {
    this.setMonths(this.months()[0], month);
  }

  private setMonths(from: number, to: number): void {
    const chosen = new Set(this.filter.chosenIn('period'));
    for (const month of chosen) this.filter.toggle('period', month);
    if (from === FIRST_MONTH && to === LAST_MONTH) return;
    for (let month = from; month <= to; month += 1) this.filter.toggle('period', String(month));
  }
}
