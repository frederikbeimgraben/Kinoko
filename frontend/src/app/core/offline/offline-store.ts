import { DestroyRef, Injectable, inject } from '@angular/core';
import type { IDBPDatabase } from 'idb';

/** Die Bereiche, die das Gerät vorhält. */
export const OFFLINE_AREAS = ['catalog', 'texts', 'objects', 'queue'] as const;

export type OfflineArea = (typeof OFFLINE_AREAS)[number];

const DB_NAME = 'primordium';

/** Eine neue Zahl legt den Speicher neu an. Es gibt keinen Migrationspfad. */
export const DB_VERSION = 2;

/**
 * Der Speicher auf dem Gerät: Katalog, Texte und eigene Objekte.
 */
@Injectable({ providedIn: 'root' })
export class OfflineStore {
  private db: Promise<IDBPDatabase | null> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => void this.close());
  }

  /** Schließt die Verbindung. Der nächste Zugriff öffnet sie neu. */
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

  /** Legt einen Wert ab. `false` heißt: das Gerät hat keinen Platz dafür. */
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

  /** Räumt jeden Bereich. „Meine Daten löschen“ geht diesen Weg. */
  async clearAll(): Promise<void> {
    for (const area of OFFLINE_AREAS) await this.clear(area);
  }

  private open(): Promise<IDBPDatabase | null> {
    this.db ??= this.create();
    return this.db;
  }

  /** `idb` kommt erst beim ersten Zugriff, nicht im ersten Bündel. */
  private async create(): Promise<IDBPDatabase | null> {
    try {
      const { openDB } = await import('idb');
      return await openDB(DB_NAME, DB_VERSION, { upgrade: rebuild });
    } catch {
      return null;
    }
  }
}

/** Ein Schemabruch wirft den alten Bestand weg und legt die Bereiche neu an. */
function rebuild(db: IDBPDatabase): void {
  for (const name of [...db.objectStoreNames]) db.deleteObjectStore(name);
  for (const area of OFFLINE_AREAS) db.createObjectStore(area);
}
