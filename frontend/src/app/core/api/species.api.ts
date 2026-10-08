import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient, type Tagged } from './api-client';
import type { SpeciesBundle, SpeciesCounts, SpeciesEntry, SpeciesWrite } from './models/catalogue';

const BUNDLE_PATH = '/species/bundle';
const SPECIES_PATH = '/species';

/** The species catalogue in one request. It is open, also without a sign-in. */
@Injectable({ providedIn: 'root' })
export class SpeciesApi {
  private readonly api = inject(ApiClient);

  /** Gets the bundle. For a known ETag the body is empty. */
  bundle(etag: string | null): Observable<Tagged<SpeciesBundle>> {
    return this.api.getTagged<SpeciesBundle>(BUNDLE_PATH, etag, { quiet: true });
  }

  /** The full profile of a species, with its reactions. A failed request shows no toast. */
  profile(slug: string): Observable<SpeciesEntry> {
    return this.api.get<SpeciesEntry>(`${SPECIES_PATH}/${encodeURIComponent(slug)}`, undefined, {
      quiet: true,
    });
  }

  /** The counts of records, finds and photos of a species. It needs `species.edit`. */
  counts(slug: string): Observable<SpeciesCounts> {
    return this.api.get<SpeciesCounts>(`${SPECIES_PATH}/${encodeURIComponent(slug)}/counts`);
  }

  /** Adds a species. The reply has the slug for the editor. */
  create(body: SpeciesWrite): Observable<SpeciesEntry> {
    return this.api.post<SpeciesEntry>(SPECIES_PATH, body);
  }

  /** Writes a full species. The contract has no partial write. */
  replace(slug: string, body: SpeciesWrite): Observable<SpeciesEntry> {
    return this.api.put<SpeciesEntry>(`${SPECIES_PATH}/${encodeURIComponent(slug)}`, body);
  }

  /** Turns the forecast of a species on or off. */
  setForecast(slug: string, enabled: boolean): Observable<SpeciesEntry> {
    return this.api.put<SpeciesEntry>(`${SPECIES_PATH}/${encodeURIComponent(slug)}/forecast`, {
      enabled,
    });
  }

  remove(slug: string): Observable<null> {
    return this.api.delete<null>(`${SPECIES_PATH}/${encodeURIComponent(slug)}`);
  }
}
