import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Eine Aktion der Schritt-Leiste. Ihre Rolle bestimmt, wie sie aussieht. */
export interface StepAction {
  readonly label: string;
  /** Die Leiste am Rechner hat Platz für das ganze Wort. */
  readonly wideLabel?: string;
  readonly variant: 'primary' | 'secondary' | 'ghost';
  readonly run: () => void;
}

/** Die Leiste eines Karten-Schritts am Rechner: Titel, Werte und Aktionen. */
@Component({
  selector: 'app-step-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './step-bar.component.html',
  styleUrl: './step-bar.component.scss',
})
export class StepBarComponent {
  readonly title = input.required<string>();
  readonly note = input('');
  readonly actions = input.required<readonly StepAction[]>();

  readonly chosen = output<StepAction>();
}
