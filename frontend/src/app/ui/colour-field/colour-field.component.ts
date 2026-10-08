import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** A colour with name and value. */
export interface ColourValue {
  readonly name: string;
  readonly hex: string;
}

/** The angle of the hard edges between many colours. */
const ANGLE = 105;

/** A soft gradient uses a flatter angle than a hard edge. */
const SOFT_ANGLE = 135;

/** One colour, a gradient over many stops, or many colours with hard edges. */
export type ColourMode = 'single' | 'gradient' | 'multiple';

/** A colour as an area. `multiple` uses hard edges, `gradient` blends. */
@Component({
  selector: 'app-colour-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './colour-field.component.html',
  styleUrl: './colour-field.component.scss',
})
export class ColourFieldComponent {
  readonly colours = input.required<readonly ColourValue[]>();
  readonly mode = input<ColourMode>('multiple');
  /** All names, for assistive technology. The visible names are at the left of the feature. */
  readonly label = input.required<string>();

  protected readonly fill = computed(() => paint(this.colours(), this.mode()));
}

/** Gives the CSS background for the mode. With no colour, it is transparent. */
export function paint(colours: readonly ColourValue[], mode: ColourMode = 'multiple'): string {
  if (colours.length === 0) return 'transparent';
  if (colours.length === 1 || mode === 'single') return colours[0].hex;
  if (mode === 'gradient')
    return `linear-gradient(${SOFT_ANGLE}deg, ${colours.map((colour) => colour.hex).join(', ')})`;
  const share = 100 / colours.length;
  const stops = colours.map((colour, index) => `${colour.hex} ${index * share}% ${(index + 1) * share}%`);
  return `linear-gradient(${ANGLE}deg,${stops.join(',')})`;
}
