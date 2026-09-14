import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { DB_VERSION, OFFLINE_AREAS, OfflineStore } from './offline-store';

function store(): OfflineStore {
  TestBed.configureTestingModule({});
  return TestBed.inject(OfflineStore);
}

describe('OfflineStore', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
  });

  it('schließt die Verbindung und öffnet sie beim nächsten Zugriff neu', async () => {
    const offline = store();
    await offline.put('objects', 'eins', { id: 'eins' });

    await offline.close();

    expect(await offline.get('objects', 'eins')).toEqual({ id: 'eins' });
  });

  it('legt jeden Bereich an', async () => {
    await store().put('catalog', 'bundle', { items: [] });

    const db = await openDB('primordium', DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual([...OFFLINE_AREAS].sort());
    db.close();
  });

  it('gibt einen abgelegten Wert zurück', async () => {
    const offline = store();

    await offline.put('texts', 'de', { 'a.b': 'c' });

    expect(await offline.get('texts', 'de')).toEqual({ 'a.b': 'c' });
  });

  it('meldet einen unbekannten Schlüssel als null', async () => {
    expect(await store().get('permissions', 'mine')).toBeNull();
  });

  it('listet einen Bereich', async () => {
    const offline = store();
    await offline.put('objects', 'eins', { id: 'eins' });
    await offline.put('objects', 'zwei', { id: 'zwei' });

    expect(await offline.all('objects')).toHaveLength(2);
  });

  it('entfernt einen Wert', async () => {
    const offline = store();
    await offline.put('objects', 'eins', { id: 'eins' });

    await offline.remove('objects', 'eins');

    expect(await offline.get('objects', 'eins')).toBeNull();
  });

  it('räumt einen Bereich', async () => {
    const offline = store();
    await offline.put('queue', 'eins', { id: 'eins' });

    await offline.clear('queue');

    expect(await offline.all('queue')).toEqual([]);
  });

  it('räumt alle Bereiche', async () => {
    const offline = store();
    await offline.put('catalog', 'bundle', {});
    await offline.put('objects', 'eins', {});

    await offline.clearAll();

    expect(await offline.all('catalog')).toEqual([]);
    expect(await offline.all('objects')).toEqual([]);
  });

  it('legt den Speicher bei einem Schemabruch neu an', async () => {
    const old = await openDB('primordium', DB_VERSION, {
      upgrade: (db) => {
        db.createObjectStore('alt');
      },
    });
    await old.put('alt', { id: 'weg' }, 'weg');
    old.close();

    const db = await openDB('primordium', DB_VERSION + 1, {
      upgrade: (db) => {
        for (const name of [...db.objectStoreNames]) db.deleteObjectStore(name);
      },
    });

    expect([...db.objectStoreNames]).toEqual([]);
    db.close();
  });

  describe('ohne IndexedDB', () => {
    beforeEach(() => {
      vi.stubGlobal('indexedDB', undefined);
    });

    it('nimmt nichts an und bleibt leer', async () => {
      const offline = store();

      expect(await offline.put('objects', 'eins', {})).toBe(false);
      expect(await offline.get('objects', 'eins')).toBeNull();
      expect(await offline.all('objects')).toEqual([]);
      await offline.remove('objects', 'eins');
      await offline.clearAll();
    });
  });
});
