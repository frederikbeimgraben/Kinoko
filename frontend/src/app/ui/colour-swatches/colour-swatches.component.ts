import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';

/** A selectable colour for a zone or marker. */
export interface ColourSwatch {
  value: string;
  label: string;
}

/** The six object colours of `MarkerFormBody.dc.html`. MapLibre accepts only real hex values. */
export const OBJECT_COLOURS: readonly `#${string}`[] = [
  '#4f8a3c',
  '#e3b341',
  '#d9822b',
  '#c0302b',
  '#7d3a78',
  '#8d938e',
];

export type SwatchSize = 's' | 'm' | 'l';

/** The colour choice for a map object. The `radiogroup` role gives arrow-key control. */
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
