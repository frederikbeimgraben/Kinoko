import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button.component';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

export type StateViewKind = 'empty' | 'error';

/** Leer- oder Fehlerzustand: Bild, Satz, eine mögliche Handlung. Per `StateView.dc.html`. */
@Component({
  selector: 'app-state-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, SvgIconComponent],
  templateUrl: './state-view.component.html',
  styleUrl: './state-view.component.scss',
})
export class StateViewComponent {
  readonly kind = input<StateViewKind>('empty');
  readonly title = input.required<string>();
  readonly icon = input<IconName>('search');
  /** Ohne Beschriftung bleibt der Zustand ohne Knopf. */
  readonly action = input('');

  readonly actionClick = output();
}
