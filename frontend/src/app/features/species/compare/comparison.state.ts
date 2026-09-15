import { Injectable, computed, inject, signal } from '@angular/core';
import type { SpeciesEntry } from '../../../core/api/models';
import { SpeciesState } from '../species.state';

/** Der Vergleich stellt zwei Arten gegenüber. */
const PAIR = 2;

/** Die Arten des Vergleichs. Die Wahl steht im Zustand, nie im Weg. */
@Injectable({ providedIn: 'root' })
export class ComparisonState {
  private readonly catalogue = inject(SpeciesState);

  private readonly chosen = signal<readonly string[]>([]);

  readonly slugs = this.chosen.asReadonly();

  /** Die gewählten Arten in der Reihenfolge der Wahl, ohne die unbekannten. */
  readonly species = computed<readonly SpeciesEntry[]>(() =>
    this.chosen()
      .map((slug) => this.catalogue.entryOf(slug))
      .filter((one): one is SpeciesEntry => one !== null),
  );

  /** Setzt die Wahl neu, etwa beim Sprung von einer Artseite. */
  set(slugs: readonly string[]): void {
    this.chosen.set([...new Set(slugs)].slice(0, PAIR));
  }

  /** Eine weitere Art tritt an die Stelle der zweiten. */
  add(slug: string): void {
    if (this.chosen().includes(slug)) return;
    this.chosen.set([...this.chosen().slice(0, PAIR - 1), slug]);
  }

  remove(slug: string): void {
    this.chosen.set(this.chosen().filter((one) => one !== slug));
  }
}
