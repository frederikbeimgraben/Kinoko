import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ButtonComponent } from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ChipGroupComponent } from '../chip-group/chip-group.component';
import { FormFieldComponent } from '../form-field/form-field.component';

/** Die Vorschläge aus dem Artboard. Ein Tipp schreibt den Satz ins Feld. */
const SUGGESTIONS: readonly TranslationKey[] = [
  'bild.grund.unscharf',
  'bild.grund.nichtErkennbar',
  'bild.grund.rechteUnklar',
  'bild.grund.falscheArt',
];

let nextNumber = 0;

/** Das Blatt nach dem Grund einer Absage. Ohne Grund geht sie nicht hinaus. */
@Component({
  selector: 'app-reject-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, ChipGroupComponent, FormFieldComponent, TranslatePipe],
  templateUrl: './reject-dialog.component.html',
  styleUrl: './reject-dialog.component.scss',
})
export class RejectDialogComponent {
  private readonly i18n = inject(I18nService);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  /** Wessen Bild abgelehnt wird. Ohne Namen fragt das Blatt niemanden. */
  readonly person = input.required<string | null>();
  readonly open = input.required<boolean>();

  readonly rejected = output<string>();
  readonly closed = output();

  protected readonly reason = signal('');
  protected readonly titleId = `app-reject-dialog-${String(nextNumber++)}`;

  protected readonly chips = computed(() =>
    SUGGESTIONS.map((key) => {
      const label = this.i18n.translate(key);
      return { value: label, label };
    }),
  );

  protected readonly hint = computed(() => {
    const person = this.person();
    return person === null
      ? this.i18n.translate('bild.grundHinweis')
      : this.i18n.translate('bild.grundHinweisPerson', { name: person });
  });

  /** Ein Grund aus Leerzeichen ist kein Grund. */
  protected readonly ready = computed(() => this.reason().trim().length > 0);

  constructor() {
    // Der Fokus folgt dem offenen Blatt, damit Escape sofort greift.
    afterRenderEffect(() => {
      if (this.open()) this.panel()?.nativeElement.focus();
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    this.cancel();
  }

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
