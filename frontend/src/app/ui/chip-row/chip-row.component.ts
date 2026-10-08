import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FilterChipComponent } from '../filter-chip/filter-chip.component';
import type { IconName } from '../svg-icon/svg-icon.component';

/** One chip of the row. An empty label shows only the icon, with `iconLabel` as its name. */
export interface ChipRowItem {
  readonly key: string;
  readonly label: string;
  readonly icon?: IconName;
  readonly on?: boolean;
  readonly iconLabel?: string;
}

/** A row of chips that scrolls to the side and fades at its end, per `kit.css` `.chiprow.fade-r`. */
@Component({
  selector: 'app-chip-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterChipComponent],
  templateUrl: './chip-row.component.html',
  styleUrl: './chip-row.component.scss',
})
export class ChipRowComponent {
  readonly chips = input.required<readonly ChipRowItem[]>();

  /** The key of the chip that the person pressed. */
  readonly chosen = output<string>();
}
