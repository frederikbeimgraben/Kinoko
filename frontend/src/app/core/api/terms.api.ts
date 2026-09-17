import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { Items, Term } from './models';

/** Der Katalog der Begriffe: Geruch, Geschmack, Bäume und Auslöser. */
@Injectable({ providedIn: 'root' })
export class TermsApi {
  private readonly api = inject(ApiClient);

  list(): Observable<Term[]> {
    return this.api.get<Items<Term>>('/terms').pipe(map((page) => page.items));
  }
}
