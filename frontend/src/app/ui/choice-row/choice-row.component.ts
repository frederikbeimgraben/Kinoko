import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxComponent } from '@stupa-makers/ui-kit';

let nextNumber = 0;

/** Wert im Filter: Kästchen, Name und die Zahl der treffenden Arten. */
@Component({
  selector: 'app-choice-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxComponent, FormsModule],
  templateUrl: './choice-row.component.html',
  styleUrl: './choice-row.component.scss',
})
export class ChoiceRowComponent {
  readonly label = input.required<string>();
  readonly count = input<string>();
  readonly checked = input(false);

  readonly toggled = output<boolean>();

  protected readonly fieldId = `app-choice-row-${nextNumber++}`;
}
