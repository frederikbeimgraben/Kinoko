import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { components } from './contract';

export type Term = components['schemas']['Term'];

/** Der Begriffskatalog: Geruch, Geschmack, Baumpartner und Auslöser. */
@Injectable({ providedIn: 'root' })
export class TermsApi {
  private readonly api = inject(ApiClient);

  all(): Observable<{ items: Term[] }> {
    return this.api.get<{ items: Term[] }>('/terms');
  }
}
