import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  contentChild,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

/** Zeile der Merkmalstabelle: Schlüssel links, ein oder mehrere Werte rechts. */
@Component({
  selector: 'app-key-value-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink],
  templateUrl: './key-value-row.component.html',
  styleUrl: './key-value-row.component.scss',
  host: { '[class.kv--columns]': 'columns()' },
})
export class KeyValueRowComponent {
  readonly key = input.required<string>();
  readonly value = input<string>();
  /** Mehrere Werte nebeneinander, eine Spalte je verglichener Art. */
  readonly values = input<readonly string[]>();
  /** Ein Schlitz je Spalte: der Vergleich stellt Fläche, Marke oder Balken hinein. */
  readonly cells = input<readonly unknown[]>();
  /** Führt der Schlüssel weiter, steht er als Verweis. */
  readonly route = input<string | null>(null);
  /** Ein Wort zum Schlüssel, das den Wert benennt: eine Fläche sagt für sich nichts. */
  readonly hint = input<string | null>(null);
  /** Ein Wert endet rechts, Fließtext beginnt links. */
  readonly flow = input(false);
  /** Die Kopfzeile eines Vergleichs: die Werte sind die Namen der Spalten. */
  readonly head = input(false);

  protected readonly slot = contentChild(TemplateRef);

  /** Die Spalten tragen schon die Namen der Arten, ein Zebra trennt dort nichts. */
  protected readonly columns = computed(() => this.cells() !== undefined || this.values() !== undefined);
}
