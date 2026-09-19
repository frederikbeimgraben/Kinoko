import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { Items, Term, TermCreate, TermKind, TermUpdate } from './models';

const PATH = '/terms';

function one(id: string): string {
  return `${PATH}/${encodeURIComponent(id)}`;
}

/** Der Katalog der Begriffe: Geruch, Geschmack, Bäume und Auslöser. */
@Injectable({ providedIn: 'root' })
export class TermsApi {
  private readonly api = inject(ApiClient);

  list(kind?: TermKind): Observable<Term[]> {
    return this.api.get<Items<Term>>(PATH, { kind }).pipe(map((page) => page.items));
  }

  create(write: TermCreate): Observable<Term> {
    return this.api.post<Term>(PATH, write);
  }

  patch(id: string, write: TermUpdate): Observable<Term> {
    return this.api.patch<Term>(one(id), write);
  }

  remove(id: string): Observable<null> {
    return this.api.delete<null>(one(id));
  }

  /** Hängt jede Verwendung auf das Zielwort um und löscht den Begriff. */
  merge(id: string, into: string): Observable<null> {
    return this.api.post<null>(`${one(id)}/merge`, { into });
  }
}
