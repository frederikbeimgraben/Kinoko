import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FloatingButtonComponent } from '../floating-button/floating-button.component';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import type { IconName } from '../svg-icon/svg-icon.component';

/** Eine Aktion der Schritt-Leiste: ein Zeichen, seine Beschriftung, seine Rolle. */
export interface StepAction {
  readonly label: string;
  readonly icon: IconName;
  readonly variant: 'primary' | 'secondary';
  readonly run: () => void;
}

/** Die schwebende Leiste eines Karten-Schritts, per `StepBar.dc.html`. */
@Component({
  selector: 'app-step-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FloatingButtonComponent, IconButtonComponent],
  templateUrl: './step-bar.component.html',
  styleUrl: './step-bar.component.scss',
})
export class StepBarComponent {
  readonly label = input.required<string>();
  /** Die Marke links der Knöpfe: der Ort oder die Zahl der Eckpunkte. */
  readonly note = input('');
  readonly actions = input.required<readonly StepAction[]>();

  readonly chosen = output<StepAction>();

  /** Die runden Knöpfe stehen vor dem Fab, wie `StepBar.dc.html` sie ordnet. */
  protected readonly secondary = computed(() =>
    this.actions().filter((action) => action.variant === 'secondary'),
  );
  protected readonly primary = computed(() =>
    this.actions().filter((action) => action.variant === 'primary'),
  );
}
