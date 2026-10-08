import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

let nextNumber = 0;

/**
 * A search field with a magnifier and a clear button for text. It stays usable while the data loads.
 */
@Component({
  selector: 'app-search-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SvgIconComponent, TranslatePipe],
  templateUrl: './search-field.component.html',
  styleUrl: './search-field.component.scss',
})
export class SearchFieldComponent {
  readonly value = input<string>('');
  readonly placeholder = input<string>('');
  /** In a bar, the field has no area of its own. */
  readonly plain = input(false);

  readonly valueChange = output<string>();

  protected readonly fieldId = `app-suchfeld-${nextNumber++}`;
  protected readonly empty = computed(() => this.value().length === 0);

  protected onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }

  protected clear(): void {
    this.valueChange.emit('');
  }
}
