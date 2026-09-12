import { Injectable, inject, signal } from '@angular/core';
import { FacetsApi } from '../../core/api/facets.api';
import type { FacetCatalogue, FacetGroup, FacetKey } from '../../core/api/models';

/**
 * Der Merkmalskatalog im Speicher. Er ändert sich nur mit den Profilen und
 * wird darum einmal geholt und danach nur gelesen.
 */
@Injectable({ providedIn: 'root' })
export class FacetState {
  private readonly api = inject(FacetsApi);
  private running = false;

  private readonly _catalogue = signal<FacetCatalogue | null>(null);
  readonly catalogue = this._catalogue.asReadonly();

  load(): void {
    if (this._catalogue() !== null || this.running) return;
    this.running = true;
    this.api.catalogue().subscribe({
      next: (catalogue) => {
        this._catalogue.set(catalogue);
        this.running = false;
      },
      error: () => (this.running = false),
    });
  }

  groupOf(key: FacetKey): FacetGroup | null {
    return this._catalogue()?.gruppen.find((group) => group.schluessel === key) ?? null;
  }

  /** Wie viele Arten der Katalog überhaupt kennt. */
  total(): number {
    return this._catalogue()?.arten ?? 0;
  }
}
