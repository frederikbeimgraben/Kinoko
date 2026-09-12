import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { Species, SpeciesCatalogue } from './models';

/** Die zwei Endpunkte des Artenkatalogs. Beide sind offen, auch ohne Anmeldung. */
@Injectable({ providedIn: 'root' })
export class SpeciesApi {
  private readonly api = inject(ApiClient);

  /**
   * Ohne Angabe kommt der ganze Katalog. `sammelbar` schränkt ein, in beide
   * Richtungen; es ist ein Filter wie jeder andere und keine Vorgabe.
   */
  catalogue(query?: { sammelbar?: boolean }): Observable<SpeciesCatalogue> {
    return this.api.get<SpeciesCatalogue>('/arten', query);
  }

  profile(slug: string): Observable<Species> {
    return this.api.get<Species>(`/arten/${encodeURIComponent(slug)}`);
  }
}
