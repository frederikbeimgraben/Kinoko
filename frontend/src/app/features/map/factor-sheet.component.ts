import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { formatValue, type Histogram, type Layer } from '../../core/tiles/layers';
import type { Condition } from '../../core/api/models';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { HistogramComponent } from '../../ui/histogram/histogram.component';
import { KeyValueRowComponent } from '../../ui/key-value-table/key-value-row.component';
import { type Handles, RangeSliderComponent } from '../../ui/range-slider/range-slider.component';
import { type SegmentOption, SegmentedComponent } from '../../ui/segmented/segmented.component';
import { SheetHeadComponent } from '../../ui/sheet-head/sheet-head.component';
import { conditionText, span, type Factor } from './factors';

/** Wie fein der Griff läuft: fein genug zum Zielen, grob genug zum Ablesen. */
export function stepSize(layer: Layer): number {
  const width = layer.high - layer.low;
  if (width > 50) return 1;
  if (width > 5) return 0.1;
  return 0.01;
}

/** Welche Griffe eine Bedingung braucht. */
const HANDLES: Record<Condition, Handles> = { below: 'to', above: 'from', between: 'both' };

const CONDITION_KEY: Record<Condition, TranslationKey> = {
  below: 'map.factor.operator.under',
  above: 'map.factor.operator.over',
  between: 'map.factor.operator.between',
};

/** Der Faktor: die Verteilung der Quelle und die Bedingung darüber. */
@Component({
  selector: 'app-factor-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    HistogramComponent,
    KeyValueRowComponent,
    RangeSliderComponent,
    SegmentedComponent,
    SheetHeadComponent,
    TranslatePipe,
  ],
  templateUrl: './factor-sheet.component.html',
  styleUrl: './factor-sheet.component.scss',
})
export class FactorSheetComponent {
  private readonly i18n = inject(I18nService);

  readonly factor = input.required<Factor>();
  readonly layer = input.required<Layer>();
  readonly histogram = input<Histogram | null>(null);

  readonly apply = output<Factor>();
  readonly removed = output<Factor>();

  /** Der Faktor in Arbeit. Ein neuer Faktor von außen setzt ihn zurück. */
  protected readonly draft = linkedSignal<Factor, Factor>({
    source: this.factor,
    computation: (factor) => factor,
  });

  protected readonly conditions = computed<SegmentOption[]>(() =>
    (['below', 'above', 'between'] as const).map((value) => ({
      value,
      label: this.i18n.translate(CONDITION_KEY[value]),
    })),
  );

  protected readonly handles = computed<Handles>(() => HANDLES[this.draft().condition]);
  protected readonly step = computed(() => stepSize(this.layer()));
  protected readonly values = computed(() => span(this.draft(), this.layer()));

  protected readonly fromShare = computed(() => this.shareOnScale(this.values().low));
  protected readonly toShare = computed(() => this.shareOnScale(this.values().high));

  protected readonly condition = computed(() =>
    conditionText(this.draft(), this.layer(), this.i18n.locale(), this.i18n.translate('common.to')),
  );

  protected readonly scaleFrom = computed(() => this.text(this.layer().low));
  protected readonly scaleTo = computed(() => this.text(this.layer().high));

  /** Die Grenze, die der Griff gerade setzt, in der Mitte der Skala. */
  protected readonly bound = computed(() =>
    this.text(this.draft().condition === 'below' ? this.values().high : this.values().low),
  );

  protected readonly distribution = computed(() =>
    this.i18n.translate('map.factor.distribution', { source: this.head() }),
  );

  protected readonly head = computed(() =>
    this.layer().note === '' ? this.layer().label : `${this.layer().label} ${this.layer().note}`,
  );

  protected setCondition(value: string): void {
    const condition = (['below', 'above', 'between'] as const).find((entry) => entry === value);
    if (!condition) return;
    // Die Spanne bleibt, wo sie war: der Wechsel der Form soll den Faktor
    // nicht auf einen anderen Ausschnitt der Skala werfen.
    const values = this.values();
    this.draft.set({ ...this.draft(), condition, low: values.low, high: values.high });
  }

  protected setFrom(value: number): void {
    this.draft.set({ ...this.draft(), low: Math.min(value, this.values().high) });
  }

  protected setTo(value: number): void {
    this.draft.set({ ...this.draft(), high: Math.max(value, this.values().low) });
  }

  private text(value: number): string {
    return formatValue(value, this.layer(), this.i18n.locale());
  }

  private shareOnScale(value: number): number {
    const width = this.layer().high - this.layer().low;
    return width === 0 ? 0 : Math.min(Math.max((value - this.layer().low) / width, 0), 1);
  }
}
