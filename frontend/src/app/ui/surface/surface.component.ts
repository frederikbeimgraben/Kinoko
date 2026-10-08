import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A surface for the content of a column, from `kit.css` `.surface`. */
@Component({
  selector: 'app-surface',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './surface.component.html',
  styleUrl: './surface.component.scss',
})
export class SurfaceComponent {
  /** An open surface runs into the bottom edge. A closed surface has all corners rounded. */
  readonly open = input(true);
}
