import { Injectable, computed, inject, signal } from '@angular/core';
import { AccessApi } from '../../core/api/access.api';
import type { SpeciesCountsEntry } from '../../core/api/models';

/** Die Zahlen jeder Art, nach Kennung. */
export type CountsBySpecies = ReadonlyMap<string, SpeciesCountsEntry>;

/** Die Zahlen der Artenverwaltung. Die Liste selbst steht im lokalen Katalog. */
@Injectable({ providedIn: 'root' })
export class AdminSpeciesState {
  private readonly api = inject(AccessApi);

  private readonly rows = signal<readonly SpeciesCountsEntry[]>([]);

  readonly counts = computed<CountsBySpecies>(() => new Map(this.rows().map((one) => [one.speciesId, one])));

  load(): void {
    if (this.rows().length > 0) return;
    this.api.speciesCounts().subscribe((entries) => {
      this.rows.set(entries);
    });
  }
}
