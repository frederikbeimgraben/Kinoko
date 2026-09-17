import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent, type ButtonVariant } from '@stupa-makers/ui-kit';

/**
 * Der Fuß trägt oben die Hauptaktion und darunter höchstens eine zweite.
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
  /** Färbt die zweite Aktion rot, etwa für „Faktor entfernen“. */
  readonly secondaryDanger = input(false);
  /** Im Modal stehen die Knöpfe nebeneinander am rechten Rand. */
  readonly inline = input(false);
  /** Zwei gleichrangige Wege: die erste Aktion trägt kein Gewicht. */
  readonly quiet = input(false);
  /** Die letzte Aktion steht ohne Rahmen und misst vierundvierzig Punkte. */
  readonly ghost = input(false);
  /** Die Hauptaktion läuft schon: Spinner statt Text, kein zweiter Auftrag. */
  readonly busy = input(false);
  /** Beide Aktionen stehen nebeneinander und teilen sich die Breite. */
  readonly split = input(false);

  readonly primaryClick = output();
  readonly secondaryClick = output();

  /** Ein laufender Auftrag behält seine Fläche; nur der zweite Weg fehlt. */
  protected readonly primaryVariant = computed<ButtonVariant>(() => {
    if (this.ghost() && this.secondary() === undefined && !this.busy()) return 'ghost';
    if (this.danger()) return this.split() ? 'danger-outline' : 'danger';
    return this.quiet() ? 'secondary' : 'primary';
  });

  /** Ein Geist-Knopf trägt die Gefahrfarbe als Schrift, nicht als Fläche. */
  protected readonly quietDanger = computed(() => this.ghost() && this.danger());

  protected readonly secondaryVariant = computed<ButtonVariant>(() => {
    if (this.secondaryDanger()) return 'danger-outline';
    return this.ghost() ? 'ghost' : 'secondary';
  });
}
