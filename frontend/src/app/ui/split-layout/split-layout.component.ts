import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Die vier Aufteilungen des Rechners: Spalte, Spaltenzug, Raster, Teilung. */
export type SplitKind = 'pane' | 'column' | 'columns' | 'split';

/** Die Rolle einer Rechner-Spalte, per `Pane.dc.html`. */
export type PaneKind = 'panel' | 'map' | 'middle' | 'detail';

/** Die festen Breiten aus `Pane.dc.html`. */
const PANE_WIDTH: Partial<Record<PaneKind, number>> = { panel: 420, middle: 640 };

/** Der Innenabstand, den jede Aufteilung ohne eigene Angabe trägt. */
const PAD: Record<SplitKind, string> = {
  pane: '',
  column: '',
  columns: '12px 32px 16px',
  split: '0 8px 0 16px',
};

/** Das Raster des Rechners. Die Eingabe `kind` wählt die Aufteilung. */
@Component({
  selector: 'app-split-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.layout--pane]': "kind() === 'pane'",
    '[class.layout--column]': "kind() === 'column'",
    '[class.layout--columns]': "kind() === 'columns'",
    '[class.layout--split]': "kind() === 'split'",
    '[class.layout--panel]': "kind() === 'pane' && pane() === 'panel'",
    '[class.layout--map]': "kind() === 'pane' && pane() === 'map'",
    '[class.layout--middle]': "kind() === 'pane' && pane() === 'middle'",
    '[class.layout--detail]': "kind() === 'pane' && pane() === 'detail'",
    '[class.layout--mid]': "ground() === 'mid'",
    '[class.layout--fixed]': 'fixed() !== null',
    '[style.inline-size.px]': 'fixed()',
  },
  templateUrl: './split-layout.component.html',
  styleUrl: './split-layout.component.scss',
})
export class SplitLayoutComponent {
  readonly kind = input<SplitKind>('column');
  readonly pane = input<PaneKind>('panel');
  /** Die Fläche hinter der Spalte, wenn sie nicht die des Rahmens ist. */
  readonly ground = input<'desk' | 'mid'>('desk');
  /** Eine feste Breite. Null lässt die Spalte den Rest nehmen. */
  readonly width = input(0);
  readonly gap = input(24);
  readonly pad = input<string | null>(null);
  readonly cols = input(2);

  protected readonly padding = computed(() => this.pad() ?? PAD[this.kind()]);

  protected readonly fixed = computed(() => {
    const own = this.width();
    if (own > 0) return own;
    return this.kind() === 'pane' ? (PANE_WIDTH[this.pane()] ?? null) : null;
  });

  protected readonly grid = computed(() => `repeat(${this.cols()}, minmax(0, 1fr))`);
}
