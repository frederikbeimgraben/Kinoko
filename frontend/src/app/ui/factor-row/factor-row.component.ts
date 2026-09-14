import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxComponent } from '@stupa-makers/ui-kit';

let nextNumber = 0;

/** Ein Faktor der Kombination: Name, Bereich und Bedingung. */
export interface CombinationFactor {
  readonly name: string;
  readonly range?: string;
  readonly condition: string;
}

/** Zeile eines Faktors: Kästchen links, Name mit Bereich, Bedingung als Knopf. */
@Component({
  selector: 'app-factor-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxComponent, FormsModule],
  templateUrl: './factor-row.component.html',
  styleUrl: './factor-row.component.scss',
})
export class FactorRowComponent {
  readonly factor = input.required<CombinationFactor>();
  readonly active = input(false);

  readonly activeChange = output<boolean>();
  readonly conditionClick = output();

  protected readonly fieldId = `app-factor-row-${nextNumber++}`;
}
