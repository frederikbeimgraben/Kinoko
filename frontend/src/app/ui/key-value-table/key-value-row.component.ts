import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Zeile der Merkmalstabelle: Schlüssel links, ein oder mehrere Werte rechts. */
@Component({
  selector: 'app-key-value-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './key-value-row.component.html',
  styleUrl: './key-value-row.component.scss',
})
export class KeyValueRowComponent {
  readonly key = input.required<string>();
  readonly value = input<string>();
  /** Mehrere Werte nebeneinander, eine Spalte je verglichener Art. */
  readonly values = input<readonly string[]>();
  /** Führt der Schlüssel weiter, steht er als Verweis. */
  readonly route = input<string | null>(null);
  /** Ein Wort zum Schlüssel, das den Wert benennt: eine Fläche sagt für sich nichts. */
  readonly hint = input<string | null>(null);
  /** Ein Wert endet rechts, Fließtext beginnt links. */
  readonly flow = input(false);
}
