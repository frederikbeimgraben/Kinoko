import { DestroyRef, Injectable, inject } from '@angular/core';
import type { IDBPDatabase } from 'idb';

/** The areas that the device keeps. */
export const OFFLINE_AREAS = ['catalog', 'texts', 'objects', 'queue'] as const;

export type OfflineArea = (typeof OFFLINE_AREAS)[number];

const DB_NAME = 'primordium';

/** A new number deletes the store and makes it again. There is no migration path. */
export const DB_VERSION = 2;

/** The store on the device: catalog, texts and own objects. */
@Injectable({ providedIn: 'root' })
export class OfflineStore {
  private db: Promise<IDBPDatabase | null> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => void this.close());
  }

  /** Closes the connection. The next access opens it again. */
  async close(): Promise<void> {
    const open = this.db;
    this.db = null;
    (await open)?.close();
  }

  async get<T>(area: OfflineArea, key: string): Promise<T | null> {
    const db = await this.open();
    if (db === null) return null;
    return ((await db.get(area, key)) as T | undefined) ?? null;
  }

  async all<T>(area: OfflineArea): Promise<readonly T[]> {
    const db = await this.open();
    return db === null ? [] : ((await db.getAll(area)) as T[]);
  }

  /** Keeps a value. `false` means that the device has no storage for it. */
  async put(area: OfflineArea, key: string, value: unknown): Promise<boolean> {
    const db = await this.open();
    if (db === null) return false;
    await db.put(area, value, key);
    return true;
  }

  async remove(area: OfflineArea, key: string): Promise<void> {
    const db = await this.open();
    await db?.delete(area, key);
  }

  async clear(area: OfflineArea): Promise<void> {
    const db = await this.open();
    await db?.clear(area);
  }

  /** Clears each area. „Meine Daten löschen“ uses this path. */
  async clearAll(): Promise<void> {
    for (const area of OFFLINE_AREAS) await this.clear(area);
  }

  private open(): Promise<IDBPDatabase | null> {
    this.db ??= this.create();
    return this.db;
  }

  /** Loads `idb` on the first access, not in the first bundle. */
  private async create(): Promise<IDBPDatabase | null> {
    try {
      const { openDB } = await import('idb');
      return await openDB(DB_NAME, DB_VERSION, { upgrade: rebuild });
    } catch {
      return null;
    }
  }
}

/** A schema change removes the old data and makes the areas again. */
function rebuild(db: IDBPDatabase): void {
  for (const name of [...db.objectStoreNames]) db.deleteObjectStore(name);
  for (const area of OFFLINE_AREAS) db.createObjectStore(area);
}
