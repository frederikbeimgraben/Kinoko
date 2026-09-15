import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** Leerzustand einer Liste: Bild, Satz, dann eine mögliche Handlung. */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  readonly text = input.required<string>();
  /** Das Bild über dem Satz. Ohne Angabe steht dort der leere Korb. */
  readonly icon = input<IconName>('empty');
  /** Die Beschriftung des Knopfs. Ohne sie bleibt der Leerzustand ein Satz. */
  readonly action = input<string>();
  /** Die Handlung führt die Seite: der Knopf trägt dann die Markenfarbe. */
  readonly leading = input(false);

  readonly actionClick = output();
}
