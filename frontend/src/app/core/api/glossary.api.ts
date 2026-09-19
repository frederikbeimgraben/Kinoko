import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { GlossaryEntry, GlossaryEntryWrite, Items } from './models';

/** Die Endpunkte des Glossars. Lesen steht jedem offen, Schreiben braucht `text.edit`. */
@Injectable({ providedIn: 'root' })
export class GlossaryApi {
  private readonly api = inject(ApiClient);

  list(): Observable<GlossaryEntry[]> {
    return this.api.get<Items<GlossaryEntry>>('/glossary').pipe(map((page) => page.items));
  }

  create(entry: GlossaryEntryWrite): Observable<GlossaryEntry> {
    return this.api.post<GlossaryEntry>('/glossary', entry);
  }

  update(id: string, entry: GlossaryEntryWrite): Observable<GlossaryEntry> {
    return this.api.put<GlossaryEntry>(`/glossary/${encodeURIComponent(id)}`, entry);
  }

  remove(id: string): Observable<null> {
    return this.api.delete<null>(`/glossary/${encodeURIComponent(id)}`);
  }
}
