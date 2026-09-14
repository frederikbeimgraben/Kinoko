import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Das Fadenkreuz auf der Karte. Es zeigt den gewählten Ort. */
@Component({
  selector: 'app-crosshair',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './crosshair.component.html',
  styleUrl: './crosshair.component.scss',
})
export class CrosshairComponent {
  readonly label = input.required<string>();
}
