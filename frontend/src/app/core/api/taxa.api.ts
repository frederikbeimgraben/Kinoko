import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { TaxonPage, TaxonRank } from './models/catalogue';

/** Die Einordnung einer Stufe. Sie ist offen, auch ohne Anmeldung. */
@Injectable({ providedIn: 'root' })
export class TaxaApi {
  private readonly api = inject(ApiClient);

  page(rank: TaxonRank, slug: string): Observable<TaxonPage> {
    return this.api.get<TaxonPage>(`/taxa/${rank}/${encodeURIComponent(slug)}`);
  }
}
