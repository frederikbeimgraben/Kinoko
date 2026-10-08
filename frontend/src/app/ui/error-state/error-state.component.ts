import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { StateViewComponent } from '../state-view/state-view.component';
import type { IconName } from '../svg-icon/svg-icon.component';

/** The error state of a load. It shows `app-state-view` in the error tone with a retry action. */
@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StateViewComponent, TranslatePipe],
  templateUrl: './error-state.component.html',
  styleUrl: './error-state.component.scss',
})
export class ErrorStateComponent {
  readonly text = input.required<string>();
  readonly icon = input<IconName>('wifi-off');

  readonly retry = output();
}
