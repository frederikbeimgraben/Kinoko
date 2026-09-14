import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Farbe } from '../../core/api/models';
import { ColourFieldComponent } from '../colour-field/colour-field.component';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Verfärbungen eines Körperteils als Karte. Jede Zeile nennt Auslöser, Von, Pfeil, Nach und Dauer. */
@Component({
  selector: 'app-colour-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColourFieldComponent, SvgIconComponent],
  templateUrl: './colour-change.component.html',
  styleUrl: './colour-change.component.scss',
})
export class ColourChangeComponent {
  readonly triggers = input.required<readonly string[]>();
  readonly from = input.required<readonly (readonly Farbe[])[]>();
  readonly to = input.required<readonly (readonly Farbe[])[]>();
  readonly fromLabels = input.required<readonly string[]>();
  readonly toLabels = input.required<readonly string[]>();
  readonly speed = input.required<readonly string[]>();
  readonly arrowLabel = input.required<string>();

  /** Zwei Farben in dieser Zeile, also ein Weg von der einen zur anderen. */
  protected changes(index: number): boolean {
    return (this.from()[index]?.length ?? 0) > 0 && (this.to()[index]?.length ?? 0) > 0;
  }
}
