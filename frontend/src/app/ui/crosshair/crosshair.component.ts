import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The crosshair on the map. It shows the selected location. */
@Component({
  selector: 'app-crosshair',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './crosshair.component.html',
  styleUrl: './crosshair.component.scss',
})
export class CrosshairComponent {
  readonly label = input.required<string>();
  /** A light halo for a dark base map. The kit cross is dark green and has none. */
  readonly halo = input(false);
}
