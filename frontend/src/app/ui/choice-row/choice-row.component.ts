import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Die Zeile steht in einer Liste oder als Kasten mit eigenem Rand. */
export type ChoiceRowVariant = 'list' | 'boxed';

/** Zeile mit Kreis-Kästchen, per `kit.css` `.box-r`. */
@Component({
  selector: 'app-choice-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './choice-row.component.html',
  styleUrl: './choice-row.component.scss',
  host: { '[class.choice-row--boxed]': "variant() === 'boxed'" },
})
export class ChoiceRowComponent {
  readonly label = input.required<string>();
  readonly count = input<string>();
  readonly checked = input(false);
  readonly variant = input<ChoiceRowVariant>('list');

  readonly toggled = output<boolean>();

  protected onChange(event: Event): void {
    this.toggled.emit((event.target as HTMLInputElement).checked);
  }
}
