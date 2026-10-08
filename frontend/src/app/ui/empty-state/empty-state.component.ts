import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { StateViewComponent } from '../state-view/state-view.component';
import type { IconName } from '../svg-icon/svg-icon.component';

/** The empty state of a list. It shows `app-state-view` with a tonal action. */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StateViewComponent],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  readonly text = input.required<string>();
  readonly icon = input<IconName>('empty');
  /** Without a label, the state has no button. */
  readonly action = input<string>();

  readonly actionClick = output();
}
