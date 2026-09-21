import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Eine Fläche für den Inhalt einer Spalte, per `kit.css` `.surface`. */
@Component({
  selector: 'app-surface',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './surface.component.html',
  styleUrl: './surface.component.scss',
})
export class SurfaceComponent {
  /** Offen läuft die Fläche in den unteren Rand, sonst ist sie ganz gerundet. */
  readonly open = input(true);
}
