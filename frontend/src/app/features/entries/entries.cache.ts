import { Injectable, inject } from '@angular/core';
import type { Find, Marker, Zone } from '../../core/api/models';
import { OfflineStore } from '../../core/offline/offline-store';

/** Die eigenen Objekte, so wie sie zuletzt vom Server kamen. */
export interface CachedEntries {
  finds: readonly Find[];
  marker: readonly Marker[];
  zones: readonly Zone[];
}

const KEY = 'entries';

/** Die eigenen Objekte auf dem Gerät. Jede Seite zeigt zuerst diesen Stand. */
@Injectable({ providedIn: 'root' })
export class EntriesCache {
  private readonly store = inject(OfflineStore);

  read(): Promise<CachedEntries | null> {
    return this.store.get<CachedEntries>('objects', KEY);
  }

  async write(entries: CachedEntries): Promise<void> {
    await this.store.put('objects', KEY, entries);
  }
}
