import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/**
 * Ein Suchfeld mit Lupe und Löschen. Das Löschen erscheint bei Inhalt.
 */
@Component({
  selector: 'app-search-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
  templateUrl: './search-field.component.html',
  styleUrl: './search-field.component.scss',
})
export class SearchFieldComponent {
  readonly value = input<string>('');
  readonly placeholder = input<string>('');
  /** Solange der Katalog lädt, bleibt das Feld eine leere Fläche. */
  readonly loading = input(false);

  readonly valueChange = output<string>();

  protected readonly empty = computed(() => this.value().length === 0);

  protected onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }

  protected clear(): void {
    this.valueChange.emit('');
  }
}
