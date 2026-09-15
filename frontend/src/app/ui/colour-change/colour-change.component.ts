import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import type { ColourValue } from '../colour-field/colour-field.component';
import { ColourFieldComponent } from '../colour-field/colour-field.component';
import { ListRowComponent } from '../list-row/list-row.component';

/** Eine Zeile Verfärbung: Auslöser, Satz darunter und die geteilte Fläche. */
interface ChangeRow {
  trigger: string;
  subline: string;
  colours: readonly ColourValue[];
  label: string;
}

const DOT = ' · ';

/** Verfärbungen eines Körperteils als Karte, in der Zeile der Farben. */
@Component({
  selector: 'app-colour-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColourFieldComponent, ListRowComponent],
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
  /** Das Wort zwischen Von und Nach, das Hilfsmittel an der Fläche lesen. */
  readonly arrowLabel = input.required<string>();

  protected readonly rows = computed<ChangeRow[]>(() =>
    this.triggers().map((trigger, index) => this.rowAt(trigger, index)),
  );

  private rowAt(trigger: string, index: number): ChangeRow {
    const start = this.fromLabels()[index] ?? '';
    const end = this.toLabels()[index] ?? '';
    const then = this.i18n.translate('species.colourChange.then');
    const path = start && end ? `${start}, ${then} ${end}` : start || end;
    return {
      trigger,
      subline: [path, this.speed()[index] ?? ''].filter(Boolean).join(DOT),
      colours: [...(this.from()[index] ?? []), ...(this.to()[index] ?? [])],
      label: start && end ? `${start} ${this.arrowLabel()} ${end}` : start || end,
    };
  }
}
