import { Injectable, computed, inject, signal } from '@angular/core';
import { SpeciesApi } from '../../core/api/species.api';
import type { StandardColour } from '../../core/api/models';

/** Die Standardfarben des Katalogs. Sie kommen mit dem Bündel der Arten. */
@Injectable({ providedIn: 'root' })
export class CatalogueState {
  private readonly api = inject(SpeciesApi);
  private readonly _colours = signal<StandardColour[] | null>(null);

  readonly standardColours = computed(() => this._colours() ?? []);

  load(): void {
    if (this._colours() !== null) return;
    this._colours.set([]);
    this.api.bundle(null).subscribe((page) => {
      this._colours.set(page.body?.standardColours ?? []);
    });
  }
}
