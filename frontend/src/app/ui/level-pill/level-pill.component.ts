import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Eine Plakette mit freier Farbe. Geometrie wie eine Marke des Kits. */
@Component({
  selector: 'app-level-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './level-pill.component.html',
  styleUrl: './level-pill.component.scss',
})
export class LevelPillComponent {
  readonly text = input.required<string>();
  readonly colour = input.required<string>();
}
