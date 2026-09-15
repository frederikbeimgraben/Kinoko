import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ButtonComponent } from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ChipGroupComponent } from '../chip-group/chip-group.component';
import { ModalLayerDirective } from '../modal-layer/modal-layer.directive';
import { FormFieldComponent } from '../form-field/form-field.component';

/** Die Vorschläge aus dem Artboard. Ein Tipp schreibt den Satz ins Feld. */
const SUGGESTIONS: readonly TranslationKey[] = [
  'image.rejectReason.blurry',
  'image.rejectReason.speciesUnclear',
  'image.rejectReason.rightsUnclear',
  'image.rejectReason.wrongSpecies',
];

/** Das Blatt nach dem Grund einer Absage. Ohne Grund geht sie nicht hinaus. */
@Component({
  selector: 'app-reject-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, ChipGroupComponent, FormFieldComponent, ModalLayerDirective, TranslatePipe],
  templateUrl: './reject-dialog.component.html',
  styleUrl: './reject-dialog.component.scss',
})
export class RejectDialogComponent {
  private readonly i18n = inject(I18nService);

  readonly open = input.required<boolean>();

  readonly rejected = output<string>();
  readonly closed = output();

  protected readonly reason = signal('');

  protected readonly chips = computed(() =>
    SUGGESTIONS.map((key) => {
      const label = this.i18n.translate(key);
      return { value: label, label };
    }),
  );

  /** Ein Grund aus Leerzeichen ist kein Grund. */
  protected readonly ready = computed(() => this.reason().trim().length > 0);

  protected pick(label: string): void {
    this.reason.set(label);
  }

  protected write(text: string): void {
    this.reason.set(text);
  }

  protected confirm(): void {
    if (!this.ready()) return;
    this.rejected.emit(this.reason().trim());
    this.reason.set('');
  }

  protected cancel(): void {
    this.reason.set('');
    this.closed.emit();
  }
}
