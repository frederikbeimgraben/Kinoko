import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { FormSheetComponent } from '../../ui/form-sheet/form-sheet.component';

/** Ein Blatt mit einem Feld: Gruppe anlegen, Gruppe beitreten. */
@Component({
  selector: 'app-group-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormFieldComponent, FormSheetComponent, TranslatePipe],
  templateUrl: './group-sheet.component.html',
  styleUrl: './group-sheet.component.scss',
})
export class GroupSheetComponent {
  readonly title = input.required<string>();
  readonly label = input.required<string>();
  readonly placeholder = input.required<string>();
  readonly submit = input.required<string>();
  /** Die Beschriftung steht als Abschnittszeile über dem Feld, nicht im Feld. */
  readonly section = input(false);
  readonly busy = input(false);

  readonly submitted = output<string>();
  readonly cancelled = output();

  protected readonly text = signal('');
}
