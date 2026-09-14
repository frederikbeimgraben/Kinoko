import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '@stupa-makers/ui-kit';

/**
 * Der Fuß eines Blatts oder einer Objektseite. Oben die Hauptaktion über
 * die volle Breite, darunter höchstens eine zweite. Die Knöpfe kommen aus
 * dem Kit, hier steht nur die Anordnung.
 */
@Component({
  selector: 'app-action-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  templateUrl: './action-bar.component.html',
  styleUrl: './action-bar.component.scss',
})
export class ActionBarComponent {
  readonly primary = input.required<string>();
  readonly secondary = input<string>();
  /** Färbt die Hauptaktion rot statt grün, etwa für „Alles löschen“. */
  readonly danger = input(false);

  readonly primaryClick = output();
  readonly secondaryClick = output();
}
