import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One figure of the row: a value with its name below it. */
export interface Stat {
  readonly value: string | number;
  readonly label: string;
}

/** Shows figures side by side, for example finds and markers in the account. */
@Component({
  selector: 'app-stat-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stat-row.component.html',
  styleUrl: './stat-row.component.scss',
})
export class StatRowComponent {
  readonly stats = input.required<readonly Stat[]>();
  readonly cols = input(3);
}
