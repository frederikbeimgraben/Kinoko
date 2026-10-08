import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ButtonComponent } from '../button/button.component';
import { ModalLayerDirective } from '../modal-layer/modal-layer.directive';

/** A confirmation, per `kit.css` `.dlg`: a question, a count as context, two buttons. */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, ModalLayerDirective, TranslatePipe],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  readonly open = input.required<boolean>();
  readonly title = input('');
  /** The count as a sentence, for example "12 finds · 4 markers". */
  readonly meta = input<string>();
  readonly danger = input(true);
  /** Two actions in a column instead of a row, as the board `DialogSignIn` shows them. */
  readonly stack = input(false);
  /** Without a value, the label is "Delete". Other actions set their own word. */
  readonly confirmLabel = input<string>();
  /** While a write runs, the confirmation takes no tap. */
  readonly confirmDisabled = input(false);

  readonly confirmed = output();
  readonly cancelled = output();
}
