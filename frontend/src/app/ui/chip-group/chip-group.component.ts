import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Ein Wert im Chip-Feld. */
export interface Chip {
  value: string;
  label: string;
}

/**
 * Mehrfachwahl in Formularen und Dialogen. Die Reihe bricht um.
 */
@Component({
  selector: 'app-chip-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
  templateUrl: './chip-group.component.html',
  styleUrl: './chip-group.component.scss',
})
export class ChipGroupComponent {
  readonly chips = input.required<readonly Chip[]>();
  readonly value = input<readonly string[]>([]);
  /** Mehr als ein Wert zugleich. Sonst ersetzt eine neue Wahl die vorige. */
  readonly multiple = input(false);
  readonly label = input.required<string>();
  readonly addable = input(false);

  readonly valueChange = output<readonly string[]>();
  readonly added = output();

  /** Eigener Stand der Wahl. Ein neuer Wert von außen setzt ihn zurück. */
  private readonly chosenValues = linkedSignal<readonly string[], readonly string[]>({
    source: this.value,
    computation: (value) => value,
  });

  protected isChosen(chip: Chip): boolean {
    return this.chosenValues().includes(chip.value);
  }

  protected toggle(chip: Chip): void {
    const current = this.chosenValues();
    const chosen = current.includes(chip.value);
    const next = this.multiple()
      ? chosen
        ? current.filter((entry) => entry !== chip.value)
        : [...current, chip.value]
      : chosen
        ? []
        : [chip.value];
    this.chosenValues.set(next);
    this.valueChange.emit(next);
  }
}
