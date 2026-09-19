import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** Eine Aktion der Schritt-Leiste: ein Zeichen, seine Beschriftung, seine Rolle. */
export interface StepAction {
  readonly label: string;
  readonly icon: IconName;
  readonly variant: 'primary' | 'secondary';
  readonly run: () => void;
}

/** Die schwebende Leiste eines Karten-Schritts: eine Marke und Zeichen-Knöpfe. */
@Component({
  selector: 'app-step-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './step-bar.component.html',
  styleUrl: './step-bar.component.scss',
})
export class StepBarComponent {
  readonly label = input.required<string>();
  /** Die Marke links der Knöpfe: der Ort oder die Zahl der Eckpunkte. */
  readonly note = input('');
  readonly actions = input.required<readonly StepAction[]>();

  readonly chosen = output<StepAction>();
}
