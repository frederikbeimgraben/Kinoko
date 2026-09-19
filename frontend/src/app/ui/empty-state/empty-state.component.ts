import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '@stupa-makers/ui-kit';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** Leerzustand einer Liste: Bild, Satz, dann eine mögliche Handlung. */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, SvgIconComponent],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  readonly text = input.required<string>();
  /** Das Bild über dem Satz. Ohne Angabe steht dort der leere Korb. */
  readonly icon = input<IconName>('empty');
  /** Die Beschriftung des Knopfs. Ohne sie bleibt der Leerzustand ein Satz. */
  readonly action = input<string>();
  /** Die Handlung als gefüllter Knopf, etwa das Anmelden ohne Konto. */
  readonly primaryAction = input(false);

  readonly actionClick = output();
}
