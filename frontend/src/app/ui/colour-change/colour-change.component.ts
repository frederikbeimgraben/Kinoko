import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import type { ColourValue } from '../colour-field/colour-field.component';
import { ColourFieldComponent } from '../colour-field/colour-field.component';
import { ListRowComponent } from '../list-row/list-row.component';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** One colour-change row: trigger, colours and the caption below. */
interface ChangeRow {
  trigger: string;
  from: readonly ColourValue[];
  to: readonly ColourValue[];
  fromLabel: string;
  toLabel: string;
  caption: string;
  /** True: two colours with an arrow. False: one colour. */
  split: boolean;
}

const DOT = ' · ';

/** The colour changes of one body part as a card. */
@Component({
  selector: 'app-colour-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColourFieldComponent, ListRowComponent, SvgIconComponent],
  templateUrl: './colour-change.component.html',
  styleUrl: './colour-change.component.scss',
})
export class ColourChangeComponent {
  private readonly i18n = inject(I18nService);

  readonly triggers = input.required<readonly string[]>();
  readonly from = input.required<readonly (readonly ColourValue[])[]>();
  readonly to = input.required<readonly (readonly ColourValue[])[]>();
  readonly fromLabels = input.required<readonly string[]>();
  readonly toLabels = input.required<readonly string[]>();
  readonly speed = input.required<readonly string[]>();
  /** The word that assistive technology reads for the arrow between the two colours. */
  readonly arrowLabel = input.required<string>();

  protected readonly rows = computed<ChangeRow[]>(() =>
    this.triggers().map((trigger, index) => this.rowAt(trigger, index)),
  );

  private rowAt(trigger: string, index: number): ChangeRow {
    const from = this.from()[index] ?? [];
    const to = this.to()[index] ?? [];
    const start = this.fromLabels()[index] ?? '';
    const end = this.toLabels()[index] ?? '';
    const then = this.i18n.translate('species.colourChange.then');
    // If the colour stays the same, the field shows it. The caption gives only the time.
    const path = end ? (start ? `${start}, ${then} ${end}` : end) : '';
    return {
      trigger,
      from,
      to,
      fromLabel: start,
      toLabel: end,
      caption: [path, this.speed()[index] ?? ''].filter(Boolean).join(DOT),
      split: from.length !== 0 && to.length !== 0,
    };
  }
}
