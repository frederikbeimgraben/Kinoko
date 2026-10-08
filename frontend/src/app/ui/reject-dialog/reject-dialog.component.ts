import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ButtonComponent } from '../button/button.component';
import { ChipGroupComponent } from '../chip-group/chip-group.component';
import { ModalLayerDirective } from '../modal-layer/modal-layer.directive';
import { FormFieldComponent } from '../form-field/form-field.component';

/** The suggestions from the artboard. A tap writes the sentence into the field. */
const SUGGESTIONS: readonly TranslationKey[] = [
  'image.rejectReason.blurry',
  'image.rejectReason.speciesUnclear',
  'image.rejectReason.rightsUnclear',
  'image.rejectReason.wrongSpecies',
];

/** The sheet that asks for the reason of a rejection. Without a reason, the rejection does not go out. */
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
  /** A suggestion that is already chosen when the sheet opens. */
  readonly suggestion = input('');

  readonly rejected = output<string>();
  readonly closed = output();

  /** The chosen suggestion. The field next to it stays empty. */
  protected readonly chosen = linkedSignal(() => this.suggestion());
  /** The written reason. It goes out before the suggestion. */
  protected readonly written = signal('');

  protected readonly chips = computed(() =>
    SUGGESTIONS.map((key) => {
      const label = this.i18n.translate(key);
      return { value: label, label };
    }),
  );

  /** A reason of only spaces is no reason. */
  protected readonly ready = computed(() => this.reason().length > 0);

  private readonly reason = computed(() => this.written().trim() || this.chosen());

  protected pick(label: string): void {
    this.chosen.set(label);
  }

  protected write(text: string): void {
    this.written.set(text);
  }

  protected confirm(): void {
    if (!this.ready()) return;
    this.rejected.emit(this.reason());
    this.clear();
  }

  protected cancel(): void {
    this.clear();
    this.closed.emit();
  }

  private clear(): void {
    this.chosen.set('');
    this.written.set('');
  }
}
