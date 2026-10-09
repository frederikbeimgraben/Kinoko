import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
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
  /** The message for a submit with an empty field. */
  readonly required = input.required<string>();
  /** A message from the service, for example an unknown invite code. */
  readonly error = input<string | null>(null);
  readonly busy = input(false);

  /** The trimmed text. The sheet sends it only when it is not empty. */
  readonly submitted = output<string>();
  /** Each change of the text, so that the caller can remove its message. */
  readonly edited = output();
  readonly cancelled = output();

  protected readonly text = signal('');
  private readonly tried = signal(false);

  protected readonly message = computed(() => {
    if (this.tried() && this.text().trim() === '') return this.required();
    return this.error();
  });

  protected change(value: string): void {
    this.text.set(value);
    this.edited.emit();
  }

  protected send(): void {
    this.tried.set(true);
    const value = this.text().trim();
    if (value !== '') this.submitted.emit(value);
  }
}
