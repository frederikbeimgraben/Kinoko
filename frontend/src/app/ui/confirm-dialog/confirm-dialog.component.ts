import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent, DialogComponent } from '@stupa-makers/ui-kit';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/**
 * Eine Bestätigung mit Frage, Zahl als Kontext und zwei Knöpfen.
 */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, DialogComponent, TranslatePipe],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  /** Die Zahl als Satz, etwa „12 Funde · 4 Marker“. */
  readonly meta = input<string>();
  readonly danger = input(true);
  /** Ohne Angabe steht dort „Löschen“. Andere Handlungen setzen ihr eigenes Wort. */
  readonly confirmLabel = input<string>();

  readonly confirmed = output();
  readonly cancelled = output();
}
