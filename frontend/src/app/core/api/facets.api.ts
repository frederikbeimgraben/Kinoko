import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { FacetCatalogue } from './models';

/** Der Merkmalskatalog: was sich filtern lässt und was es kostet. */
@Injectable({ providedIn: 'root' })
export class FacetsApi {
  private readonly api = inject(ApiClient);

  catalogue(): Observable<FacetCatalogue> {
    return this.api.get<FacetCatalogue>('/arten/merkmale');
  }
}
