import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FORECAST_RAMP, RAIN_RAMP } from './ramp-colours';

export type RampKind = 'forecast' | 'rain';

/** Legende einer Darstellung: Beschriftung, Farbverlauf, beide Enden. */
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
  /** Ein Satz unter der Skala, der sagt, wie fein sie überhaupt misst. */
  readonly note = input<string>();

  protected readonly resolvedColours = computed(
    () => this.colours() ?? (this.kind() === 'rain' ? RAIN_RAMP : FORECAST_RAMP),
  );
}
