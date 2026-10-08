import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { FormSheetComponent } from '../../ui/form-sheet/form-sheet.component';

/** A sheet with one required field, per `GroupCreateBody.dc.html` and `GroupJoinBody.dc.html`. */
@Component({
  selector: 'app-group-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormFieldComponent, FormSheetComponent],
  templateUrl: './group-sheet.component.html',
  styleUrl: './group-sheet.component.scss',
})
export class GroupSheetComponent {
  readonly title = input.required<string>();
  readonly label = input.required<string>();
  readonly submit = input.required<string>();
  readonly busy = input(false);

  readonly submitted = output<string>();
  readonly cancelled = output();

  protected readonly text = signal('');
}
