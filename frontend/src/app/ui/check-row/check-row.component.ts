import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxComponent } from '@stupa-makers/ui-kit';

let nextNumber = 0;

/** Zeile mit dem Kästchen des Kits: Haken links, Titel und Unterzeile rechts. */
@Component({
  selector: 'app-check-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxComponent, FormsModule],
  templateUrl: './check-row.component.html',
  styleUrl: './check-row.component.scss',
})
export class CheckRowComponent {
  readonly title = input.required<string>();
  readonly subline = input<string>();
  readonly checked = input(false);
  /** Eine Zahl am rechten Rand, etwa wie viele Objekte die Zeile schaltet. */
  readonly value = input<string>();
  /** Eine feste Rolle trägt jedes Recht und lässt es sich nicht abwählen. */
  readonly locked = input(false);

  readonly toggled = output<boolean>();

  protected readonly fieldId = `app-check-row-${nextNumber++}`;
}
