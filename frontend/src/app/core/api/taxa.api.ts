import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { TaxonPage, TaxonRank } from './models/catalogue';

/** The taxonomy of one rank. It is public and needs no sign-in. */
@Injectable({ providedIn: 'root' })
export class TaxaApi {
  private readonly api = inject(ApiClient);

  page(rank: TaxonRank, slug: string): Observable<TaxonPage> {
    return this.api.get<TaxonPage>(`/taxa/${rank}/${encodeURIComponent(slug)}`);
  }
}
