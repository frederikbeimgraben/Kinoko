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
import { layerIcon } from '../../core/tiles/layer-groups';
import { formatValue, type Histogram, type Layer } from '../../core/tiles/layers';
import type { Condition } from '../../core/api/models';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { HistogramComponent } from '../../ui/histogram/histogram.component';
import { type Handles, RangeSliderComponent } from '../../ui/range-slider/range-slider.component';
import { type SegmentOption, SegmentedComponent } from '../../ui/segmented/segmented.component';
import { SheetHeadComponent } from '../../ui/sheet-head/sheet-head.component';
import type { IconName } from '../../ui/svg-icon/svg-icon.component';
import { conditionText, span, type Factor } from './factors';

import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SectionComponent } from '../../ui/section/section.component';
import { layerName, layerPeriod } from './layer-name';

/** The step of the handle: fine enough to aim, coarse enough to read. */
export function stepSize(layer: Layer): number {
  const width = layer.high - layer.low;
  if (width > 50) return 1;
  if (width > 5) return 0.1;
  return 0.01;
}

/** The handles of each condition. */
const HANDLES: Record<Condition, Handles> = { below: 'to', above: 'from', between: 'both' };

const CONDITION_KEY: Record<Condition, TranslationKey> = {
  below: 'map.factor.operator.under',
  above: 'map.factor.operator.over',
  between: 'map.factor.operator.between',
};

/** The factor: the distribution of the source and the condition on it. */
@Component({
  selector: 'app-factor-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    FormFieldComponent,
    HistogramComponent,
    ListRowComponent,
    RangeSliderComponent,
    RowGroupComponent,
    ScrollFadeDirective,
    SectionComponent,
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
  /** In the column, the page has the head. The sheet then has no head. */
  readonly withHead = input(true);
  readonly layer = input.required<Layer>();
  readonly histogram = input<Histogram | null>(null);

  readonly apply = output<Factor>();
  readonly removed = output<Factor>();

  /** The factor in work. A new factor from the parent resets it. */
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

  protected readonly glyph = computed<IconName | undefined>(() => layerIcon(this.layer().id) ?? undefined);
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

  /** The limit that the handle sets, in the middle of the scale. */
  protected readonly bound = computed(() =>
    this.text(this.draft().condition === 'below' ? this.values().high : this.values().low),
  );

  protected readonly distribution = computed(() =>
    this.i18n.translate('map.factor.distribution', { source: this.head() }),
  );

  /** The name of the source in the language of the app. */
  protected readonly name = computed(() => layerName(this.layer(), this.i18n));

  /** One value for each week, or one value for all weeks. */
  protected readonly period = computed(() => layerPeriod(this.layer(), this.i18n));

  /** The source with its period, as the heading gives it. */
  protected readonly head = computed(() => {
    const range = this.layer().range;
    return range === '' ? this.name() : `${this.name()} ${range}`;
  });

  protected setCondition(value: string): void {
    const condition = (['below', 'above', 'between'] as const).find((entry) => entry === value);
    if (!condition) return;
    // The range stays: a change of the condition does not move the factor to another part of the scale.
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
