import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '@stupa-makers/ui-kit';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ModalLayerDirective } from '../modal-layer/modal-layer.directive';

/** Eine Bestätigung: Frage, Zahl als Kontext, zwei Knöpfe. */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, ModalLayerDirective, TranslatePipe],
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
  /** Solange ein Schreibvorgang läuft, nimmt die Bestätigung keinen Tipp an. */
  readonly confirmDisabled = input(false);

  readonly confirmed = output();
  readonly cancelled = output();
}
