import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

let nextNumber = 0;

/** The on-screen keyboard for the field type. */
type InputMode = 'text' | 'numeric' | 'decimal' | 'search';

/** The label of the enter key on the on-screen keyboard. */
type EnterKeyHint = 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';

/** A form field. The kit field does not support `inputmode`. */
@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './form-field.component.html',
  styleUrl: './form-field.component.scss',
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly value = input<string>('');
  readonly placeholder = input<string>('');
  readonly multiline = input(false);
  /** `date` and `number` use the system keyboard. */
  readonly kind = input<'text' | 'number' | 'date'>('text');
  /** The field only shows a value. A tap opens a selection. */
  readonly readOnly = input(false);
  /** Shows an arrow at the end of the field for a separate selection. */
  readonly chevron = input(false);
  /** An icon before the input, for example the magnifier in a search field. */
  readonly icon = input<IconName>();
  /** Hides the label visually but keeps it for assistive technology. */
  readonly hideLabel = input(false);
  /** Shows the label as a section line above the field. */
  readonly section = input(false);
  /** The text to show when it is not the value, for example a formatted date. */
  readonly display = input<string>('');
  /** Overrides the on-screen keyboard that `kind` gives. */
  readonly inputMode = input<InputMode>();
  /** Overrides the enter key that `multiline` gives. */
  readonly enterKeyHint = input<EnterKeyHint>();

  readonly valueChange = output<string>();
  readonly displayClick = output();

  protected readonly fieldId = `app-feld-${nextNumber++}`;
  protected readonly empty = computed(() => this.value().length === 0);
  protected readonly shown = computed(() => {
    if (this.empty()) return this.placeholder();
    return this.display() || this.value();
  });

  protected readonly mode = computed<InputMode>(
    () => this.inputMode() ?? (this.kind() === 'number' ? 'numeric' : 'text'),
  );
  protected readonly hint = computed<EnterKeyHint>(
    () => this.enterKeyHint() ?? (this.multiline() ? 'enter' : 'done'),
  );

  protected onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }
}
