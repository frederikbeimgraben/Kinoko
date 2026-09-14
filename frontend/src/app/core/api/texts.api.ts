import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Locale } from '../i18n/translations';
import { ApiClient, type Tagged } from './api-client';
import type { TextCatalogue, TextEntry } from './models';

/**
 * Die drei Endpunkte der Oberflächentexte. Lesen ist offen, Ändern und
 * Zurücksetzen hängen am Recht `text.edit`; geprüft wird das im Backend.
 */
@Injectable({ providedIn: 'root' })
export class TextsApi {
  private readonly api = inject(ApiClient);

  catalogue(etag: string | null): Observable<Tagged<TextCatalogue>> {
    return this.api.getTagged<TextCatalogue>('/texts', etag);
  }

  change(key: string, locale: Locale, value: string): Observable<TextEntry> {
    return this.api.put<TextEntry>(`/texts/${encodeURIComponent(key)}`, { locale, value });
  }

  reset(key: string, locale: Locale): Observable<TextEntry> {
    return this.api.delete<TextEntry>(`/texts/${encodeURIComponent(key)}`, { locale });
  }
}
