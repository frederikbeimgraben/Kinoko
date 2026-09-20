import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BannerComponent } from '../../../../ui/banner/banner.component';
import { ColourFieldComponent, type ColourValue } from '../../../../ui/colour-field/colour-field.component';
import {
  ColourPickerComponent,
  type ColourPickerSwatch,
} from '../../../../ui/colour-picker/colour-picker.component';
import { FoldSectionComponent } from '../../../../ui/fold-section/fold-section.component';
import { HistogramComponent } from '../../../../ui/histogram/histogram.component';
import { PrivateImageComponent } from '../../../../ui/private-image/private-image.component';
import {
  SeasonCurveComponent,
  type MonthMark,
  type SeasonSeries,
} from '../../../../ui/season-curve/season-curve.component';
import { WeekButtonComponent } from '../../../../ui/timeline/week-button.component';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../../../core/i18n/translations';
import { BlockCardComponent } from '../block-card/block-card.component';

/** Ein Gaußhügel, wie ihn `Histogram.dc.html` und `SeasonCurve.dc.html` malen. */
function gauss(i: number, peak: number, spread: number): number {
  return Math.exp(-((i - peak) ** 2) / spread);
}

const HISTOGRAM_SHARES: readonly number[] = Array.from(
  { length: 40 },
  (_, i) => gauss(i, 14, 90) + 0.35 * gauss(i, 30, 60),
);

const SEASON_SERIES: readonly SeasonSeries[] = [
  { shape: 'area', values: Array.from({ length: 52 }, (_, i) => gauss(i, 39, 18)) },
];

const SEASON_MONTHS: readonly MonthMark[] = [
  { text: 'Jan', week: 1 },
  { text: 'Apr', week: 14 },
  { text: 'Jul', week: 27 },
  { text: 'Okt', week: 40 },
  { text: 'Dez', week: 49 },
];

const COLOUR_ROW_SWATCH: readonly ColourValue[] = [
  { name: 'creamy white', hex: '#f2e8d5' },
  { name: 'ochre', hex: '#c9a877' },
];

const TONE_KEYS: readonly TranslationKey[] = [
  'enum.colour.white',
  'enum.colour.cream',
  'enum.colour.yellow',
  'enum.colour.orange',
  'enum.colour.redBrown',
  'enum.colour.brown',
  'enum.colour.darkBrown',
  'enum.colour.olive',
  'enum.colour.green',
  'enum.colour.red',
  'enum.colour.violet',
  'enum.colour.grey',
];

const TONE_VALUES: readonly string[] = [
  '#f2efe6',
  '#e8d9b5',
  '#e3b341',
  '#d9822b',
  '#a9552f',
  '#7a4a2a',
  '#3f2a1c',
  '#8a9440',
  '#4f8a3c',
  '#c0302b',
  '#7d3a78',
  '#8d938e',
];

/** The eight D1 data blocks, each with its verified board default. */
@Component({
  selector: 'app-data-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BannerComponent,
    BlockCardComponent,
    ColourFieldComponent,
    ColourPickerComponent,
    FoldSectionComponent,
    HistogramComponent,
    PrivateImageComponent,
    SeasonCurveComponent,
    TranslatePipe,
    WeekButtonComponent,
  ],
  templateUrl: './data-cards.component.html',
  styleUrl: './data-cards.component.scss',
})
export class DataCardsComponent {
  private readonly i18n = inject(I18nService);

  protected readonly histogramShares = HISTOGRAM_SHARES;
  protected readonly seasonSeries = SEASON_SERIES;
  protected readonly seasonMonths = SEASON_MONTHS;
  protected readonly colourRowSwatch = COLOUR_ROW_SWATCH;

  protected readonly toneGridSwatches: readonly ColourPickerSwatch[] = TONE_KEYS.map((key, index) => ({
    value: TONE_VALUES[index],
    label: this.i18n.translate(key),
  }));
}
