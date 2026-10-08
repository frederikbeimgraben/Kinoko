import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

let nextNumber = 0;

/** A row with a check box, per `CheckRow.dc.html` and `kit.css` `.box-c`. */
@Component({
  selector: 'app-check-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './check-row.component.html',
  styleUrl: './check-row.component.scss',
})
export class CheckRowComponent {
  readonly title = input.required<string>();
  readonly subline = input<string>();
  readonly checked = input(false);
  /** A fixed role has each right. The row is then dim (`.row.off`) and does not toggle. */
  readonly locked = input(false);
  /** The count at the end of the row, per `.num`. */
  readonly count = input<number>();
  /** Without a card around the row, its content stays at the edge of the area. */
  readonly flush = input(false);

  readonly toggled = output<boolean>();

  protected readonly fieldId = `app-check-row-${nextNumber++}`;

  protected onToggle(event: Event): void {
    this.toggled.emit((event.target as HTMLInputElement).checked);
  }
}
