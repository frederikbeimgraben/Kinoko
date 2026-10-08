import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FORECAST_RAMP, RAIN_RAMP } from './ramp-colours';

export type RampKind = 'forecast' | 'rain';

/** The legend of a view, per the board `Legend`: the label, the colour steps and the two ends. */
@Component({
  selector: 'app-ramp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ramp.component.html',
  styleUrl: './ramp.component.scss',
})
export class RampComponent {
  readonly label = input.required<string>();
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  readonly kind = input<RampKind>('forecast');
  readonly colours = input<readonly string[]>();
  /** A sentence below the scale that tells how fine it measures. */
  readonly note = input<string>();

  private readonly resolvedColours = computed(
    () => this.colours() ?? (this.kind() === 'rain' ? RAIN_RAMP : FORECAST_RAMP),
  );

  /** Per `kit.css` `.legend .ramp`: each step ends at a whole percent, the last step takes the remainder. */
  protected readonly steps = computed(() => {
    const colours = this.resolvedColours();
    const edge = (index: number): number => Math.floor((index * 100) / colours.length);
    return colours.map((colour, index) => ({ colour, width: edge(index + 1) - edge(index) }));
  });
}
