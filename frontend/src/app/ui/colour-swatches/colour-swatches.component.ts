import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';

/** Eine wählbare Farbe für Zone oder Marker. */
export interface ColourSwatch {
  value: string;
  label: string;
}

/** Die sechs Objektfarben. MapLibre nimmt nur echte Hex-Werte an. */
export const OBJECT_COLOURS: readonly `#${string}`[] = [
  '#004225',
  '#8c6820',
  '#185468',
  '#8c1c16',
  '#876010',
  '#3a3f3b',
];

export type SwatchSize = 's' | 'm' | 'l';

/** Die Farbwahl für ein Kartenobjekt. Rolle `radiogroup` trägt die Pfeiltasten. */
@Component({
  selector: 'app-colour-swatches',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective],
  templateUrl: './colour-swatches.component.html',
  styleUrl: './colour-swatches.component.scss',
})
export class ColourSwatchesComponent {
  readonly colours = input.required<readonly ColourSwatch[]>();
  readonly value = input.required<string>();
  readonly label = input.required<string>();
  readonly size = input<SwatchSize>('m');

  readonly valueChange = output<string>();
}
