import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FORECAST_RAMP } from './ramp-colours';

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
  readonly colours = input<readonly string[]>(FORECAST_RAMP);
  /** Ein Satz unter der Skala, der sagt, wie fein sie überhaupt misst. */
  readonly note = input<string>();
}
