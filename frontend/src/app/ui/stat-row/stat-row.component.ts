import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Eine Kennzahl der Reihe: ein Wert, darunter sein Name. */
export interface Stat {
  readonly value: string | number;
  readonly label: string;
}

/** Kennzahlen nebeneinander, etwa Funde und Marker im Konto. */
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
