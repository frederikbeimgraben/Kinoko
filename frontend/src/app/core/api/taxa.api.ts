import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { Items } from './models';
import type { TaxonPage, TaxonRank, TaxonStep } from './models/catalogue';

/** The taxonomy. It is public and needs no sign-in. */
@Injectable({ providedIn: 'root' })
export class TaxaApi {
  private readonly api = inject(ApiClient);

  page(rank: TaxonRank, slug: string): Observable<TaxonPage> {
    return this.api.get<TaxonPage>(`/taxa/${rank}/${encodeURIComponent(slug)}`);
  }

  /** The taxa by latin name, all or those of one rank. */
  list(rank?: TaxonRank): Observable<TaxonStep[]> {
    return this.api.get<Items<TaxonStep>>('/taxa', { rank }).pipe(map((page) => page.items));
  }
}
