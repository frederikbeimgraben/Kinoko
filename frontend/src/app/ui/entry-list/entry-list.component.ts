import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { EntryRowComponent, type EntryRowEntry } from '../entry-row/entry-row.component';

/** One row of the list, grouped by an optional day label. */
export interface EntryListRow {
  readonly key: string;
  readonly day?: string;
  readonly entry: EntryRowEntry;
  readonly pending?: boolean;
  readonly selected?: boolean;
}

/** Finds, markers or zones grouped by day, per `kit.css` `.list`, `.lbl`. */
@Component({
  selector: 'app-entry-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EntryRowComponent],
  templateUrl: './entry-list.component.html',
  styleUrl: './entry-list.component.scss',
})
export class EntryListComponent<T extends EntryListRow = EntryListRow> {
  readonly rows = input.required<readonly T[]>();

  readonly chosen = output<T>();

  protected isNewDay(row: T, index: number): boolean {
    if (!row.day) return false;
    return index === 0 || this.rows()[index - 1]?.day !== row.day;
  }
}
