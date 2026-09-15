import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { FIND, MARKER, ZONE } from '../../testing/entries-fixture';
import { EntriesCache } from './entries.cache';

describe('EntriesCache', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    TestBed.configureTestingModule({});
  });

  it('meldet einen leeren Speicher als null', async () => {
    expect(await TestBed.inject(EntriesCache).read()).toBeNull();
  });

  it('legt die eigenen Objekte ab und gibt sie zurück', async () => {
    const cache = TestBed.inject(EntriesCache);

    await cache.write({ finds: [FIND], markers: [MARKER], zones: [ZONE] });

    expect((await cache.read())?.finds).toEqual([FIND]);
  });
});
