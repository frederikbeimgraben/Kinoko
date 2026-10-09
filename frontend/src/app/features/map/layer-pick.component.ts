import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import type { Layer } from '../../core/tiles/layers';
import { ChoiceRowComponent } from '../../ui/choice-row/choice-row.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { layerName, layerPeriod } from './layer-name';

/** The input layers as one group of radio rows, per the board `LayerPickBody`. */
@Component({
  selector: 'app-layer-pick',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChoiceRowComponent, RowGroupComponent],
  template: `
    <app-row-group role="radiogroup" [attr.aria-label]="label()">
      @for (row of rows(); track row.layer.id) {
        <app-choice-row
          [label]="row.name"
          [subline]="row.layer.id === selected() ? row.period : undefined"
          [checked]="row.layer.id === selected()"
          (toggled)="chosen.emit(row.layer)"
        />
      }
    </app-row-group>
  `,
})
export class LayerPickComponent {
  readonly layers = input.required<readonly Layer[]>();
  readonly selected = input<string | null>(null);
  readonly label = input.required<string>();

  readonly chosen = output<Layer>();

  private readonly i18n = inject(I18nService);

  /** Each layer with its name in the language of the app. */
  protected readonly rows = computed(() =>
    this.layers().map((layer) => ({
      layer,
      name: layerName(layer, this.i18n),
      period: layerPeriod(layer, this.i18n),
    })),
  );
}
