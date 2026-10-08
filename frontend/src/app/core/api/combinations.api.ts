import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { Combination, CombinationInput, CombinationPage } from './models';

/** The own combinations. Each route needs an account. */
@Injectable({ providedIn: 'root' })
export class CombinationsApi {
  private readonly api = inject(ApiClient);

  catalogue(): Observable<CombinationPage> {
    return this.api.get<CombinationPage>('/combinations');
  }

  create(input: CombinationInput): Observable<Combination> {
    return this.api.post<Combination>('/combinations', input);
  }

  /** Makes the combination with this ID or replaces it. */
  put(id: string, input: CombinationInput): Observable<Combination> {
    return this.api.put<Combination>(`/combinations/${encodeURIComponent(id)}`, input);
  }

  /** The response is empty. The caller only waits for it. */
  remove(id: string): Observable<null> {
    return this.api.delete<null>(`/combinations/${encodeURIComponent(id)}`);
  }
}
