import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ButtonComponent } from '@stupa-makers/ui-kit';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

let nextNumber = 0;

/** Eine Bestätigung: Frage, Zahl als Kontext, zwei Knöpfe. Baut sich selbst. */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, TranslatePipe],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

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

  protected readonly titleId = `app-confirm-dialog-${String(nextNumber++)}`;

  constructor() {
    // Der Fokus folgt der offenen Frage, damit Escape sofort greift.
    afterRenderEffect(() => {
      if (this.open()) this.panel()?.nativeElement.focus();
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    this.cancelled.emit();
  }
}
