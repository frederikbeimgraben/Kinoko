import type { Provider } from '@angular/core';
import { OfflineStore, OFFLINE_AREAS, type OfflineArea } from '../core/offline/offline-store';

/** Der Speicher des Geräts im Arbeitsspeicher, ohne IndexedDB. */
export class OfflineStoreDouble {
  readonly values = new Map<string, unknown>();

  get<T>(area: OfflineArea, key: string): Promise<T | null> {
    return Promise.resolve((this.values.get(`${area}/${key}`) as T | undefined) ?? null);
  }

  all<T>(area: OfflineArea): Promise<readonly T[]> {
    const wanted = `${area}/`;
    const found: T[] = [];
    for (const [key, value] of this.values) if (key.startsWith(wanted)) found.push(value as T);
    return Promise.resolve(found);
  }

  put(area: OfflineArea, key: string, value: unknown): Promise<boolean> {
    this.values.set(`${area}/${key}`, value);
    return Promise.resolve(true);
  }

  remove(area: OfflineArea, key: string): Promise<void> {
    this.values.delete(`${area}/${key}`);
    return Promise.resolve();
  }

  clear(area: OfflineArea): Promise<void> {
    for (const key of [...this.values.keys()]) if (key.startsWith(`${area}/`)) this.values.delete(key);
    return Promise.resolve();
  }

  async clearAll(): Promise<void> {
    for (const area of OFFLINE_AREAS) await this.clear(area);
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

export function offlineProvider(store: OfflineStoreDouble): Provider {
  return { provide: OfflineStore, useValue: store };
}
