import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button.component';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

export type StateViewKind = 'empty' | 'error';

/** An empty or error state per `StateView.dc.html`: an icon, a title and one optional action. */
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
  /** Without a label, the state has no button. */
  readonly action = input('');
  /** A second line below the title, for example why the action is off. */
  readonly text = input('');
  readonly actionBusy = input(false);
  readonly actionDisabled = input(false);

  readonly actionClick = output();
}
