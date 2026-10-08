import { Injectable, inject } from '@angular/core';
import type { Find, Marker, Zone } from '../../core/api/models';
import { OfflineStore } from '../../core/offline/offline-store';

/** The objects of the user, as the server gave them last. */
export interface CachedEntries {
  finds: readonly Find[];
  markers: readonly Marker[];
  zones: readonly Zone[];
}

const KEY = 'entries';

/** Keeps the objects of the user on the device. Each page shows this data first. */
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
