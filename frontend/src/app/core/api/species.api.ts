import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient, type Tagged } from './api-client';
import type { SpeciesBundle, SpeciesCounts, SpeciesEntry } from './models/catalogue';

const BUNDLE_PATH = '/species/bundle';
const SPECIES_PATH = '/species';

/** Der Artenkatalog in einem Zug. Er ist offen, auch ohne Anmeldung. */
@Injectable({ providedIn: 'root' })
export class SpeciesApi {
  private readonly api = inject(ApiClient);

  /** Holt das Bündel. Zum bekannten ETag bleibt der Körper leer. */
  bundle(etag: string | null): Observable<Tagged<SpeciesBundle>> {
    return this.api.getTagged<SpeciesBundle>(BUNDLE_PATH, etag, { quiet: true });
  }

  /** Das volle Profil einer Art. */
  profile(slug: string): Observable<SpeciesEntry> {
    return this.api.get<SpeciesEntry>(`${SPECIES_PATH}/${encodeURIComponent(slug)}`);
  }

  /** Datenbestand, Funde und Bilder einer Art. Braucht `species.edit`. */
  counts(slug: string): Observable<SpeciesCounts> {
    return this.api.get<SpeciesCounts>(`${SPECIES_PATH}/${encodeURIComponent(slug)}/counts`);
  }

  /** Schaltet die Vorhersage einer Art an oder aus. */
  setForecast(slug: string, enabled: boolean): Observable<SpeciesEntry> {
    return this.api.put<SpeciesEntry>(`${SPECIES_PATH}/${encodeURIComponent(slug)}/forecast`, {
      enabled,
    });
  }

  remove(slug: string): Observable<null> {
    return this.api.delete<null>(`${SPECIES_PATH}/${encodeURIComponent(slug)}`);
  }
}
