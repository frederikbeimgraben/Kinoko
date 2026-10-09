import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FloatingButtonComponent } from '../floating-button/floating-button.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import type { IconName } from '../svg-icon/svg-icon.component';

/** An action of the step bar: an icon, its label and its role. */
export interface StepAction {
  readonly label: string;
  readonly icon: IconName;
  readonly variant: 'primary' | 'secondary';
  readonly run: () => void;
  /** An action without effect in the current state, for example undo without a point. */
  readonly disabled?: boolean;
}

/** The floating bar of a step on the map, per `StepBar.dc.html`. */
@Component({
  selector: 'app-step-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FloatingButtonComponent, IconButtonComponent],
  templateUrl: './step-bar.component.html',
  styleUrl: './step-bar.component.scss',
})
export class StepBarComponent {
  readonly label = input.required<string>();
  /** The status for screen readers: the point or the number of corners. */
  readonly note = input('');
  readonly actions = input.required<readonly StepAction[]>();

  readonly chosen = output<StepAction>();

  /** The round buttons stand before the FAB, as in `StepBar.dc.html`. */
  protected readonly secondary = computed(() =>
    this.actions().filter((action) => action.variant === 'secondary'),
  );
  protected readonly primary = computed(() =>
    this.actions().filter((action) => action.variant === 'primary'),
  );
}
