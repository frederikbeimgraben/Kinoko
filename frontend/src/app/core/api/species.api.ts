import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient, type Tagged } from './api-client';
import type { SpeciesBundle } from './models/catalogue';

const BUNDLE_PATH = '/species/bundle';

/** Der Artenkatalog in einem Zug. Er ist offen, auch ohne Anmeldung. */
@Injectable({ providedIn: 'root' })
export class SpeciesApi {
  private readonly api = inject(ApiClient);

  /** Holt das Bündel. Zum bekannten ETag bleibt der Körper leer. */
  bundle(etag: string | null): Observable<Tagged<SpeciesBundle>> {
    return this.api.getTagged<SpeciesBundle>(BUNDLE_PATH, etag, { quiet: true });
  }
}
