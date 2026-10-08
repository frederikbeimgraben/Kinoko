import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Layer } from '../../core/tiles/layers';
import { ChoiceRowComponent } from '../../ui/choice-row/choice-row.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';

/** The input layers as one group of radio rows, per the board `LayerPickBody`. */
@Component({
  selector: 'app-layer-pick',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChoiceRowComponent, RowGroupComponent],
  template: `
    <app-row-group role="radiogroup" [attr.aria-label]="label()">
      @for (layer of layers(); track layer.id) {
        <app-choice-row
          [label]="layer.label"
          [subline]="layer.id === selected() ? layer.note : undefined"
          [checked]="layer.id === selected()"
          (toggled)="chosen.emit(layer)"
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
}
