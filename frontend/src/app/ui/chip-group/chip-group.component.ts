import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FilterChipComponent } from '../filter-chip/filter-chip.component';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** A value in the chip field. */
export interface Chip {
  value: string;
  label: string;
}

/**
 * Multi-select or single choice in forms and dialogs, per `kit.css` `.chips`.
 */
@Component({
  selector: 'app-chip-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterChipComponent, RippleDirective, SvgIconComponent, TranslatePipe],
  templateUrl: './chip-group.component.html',
  styleUrl: './chip-group.component.scss',
})
export class ChipGroupComponent {
  readonly chips = input.required<readonly Chip[]>();
  readonly value = input<readonly string[]>([]);
  /** More than one value at once. Otherwise a new choice replaces the last. */
  readonly multiple = input(false);
  readonly label = input.required<string>();
  readonly addable = input(false);
  /** The 32 px chip, per `kit.css` `.chip.sm`, as `ChipSet` uses it. */
  readonly small = input(false);

  readonly valueChange = output<readonly string[]>();
  readonly added = output();

  /** Own state of the choice. A new value from outside resets it. */
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
