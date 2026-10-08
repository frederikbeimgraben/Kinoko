import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The frame of a trait table. The rows come as projected content. */
@Component({
  selector: 'app-key-value-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--key-value-table-columns]': 'columns()' },
  templateUrl: './key-value-table.component.html',
  styleUrl: './key-value-table.component.scss',
})
export class KeyValueTableComponent {
  /** The number of value columns in the rows. A comparison gives one for each species. */
  readonly columns = input(1);
}
