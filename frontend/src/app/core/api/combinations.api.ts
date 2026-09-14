import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { Combination, CombinationInput, CombinationPage } from './models';

/** Die eigenen Kombinationen. Jede Route braucht ein Konto. */
@Injectable({ providedIn: 'root' })
export class CombinationsApi {
  private readonly api = inject(ApiClient);

  catalogue(): Observable<CombinationPage> {
    return this.api.get<CombinationPage>('/combinations');
  }

  create(input: CombinationInput): Observable<Combination> {
    return this.api.post<Combination>('/combinations', input);
  }

  /** Legt die Kombination mit dieser Kennung an oder ersetzt sie. */
  put(id: string, input: CombinationInput): Observable<Combination> {
    return this.api.put<Combination>(`/combinations/${encodeURIComponent(id)}`, input);
  }

  /** Die Antwort ist leer; der Aufrufer wartet nur darauf, dass sie kommt. */
  remove(id: string): Observable<null> {
    return this.api.delete<null>(`/combinations/${encodeURIComponent(id)}`);
  }
}
