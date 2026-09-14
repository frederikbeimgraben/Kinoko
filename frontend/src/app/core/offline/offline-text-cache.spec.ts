import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { OfflineTextCache } from './offline-text-cache';

import type { CachedTexts } from '../i18n/text-cache';

const CATALOGUE: CachedTexts = {
  etag: 'W/"eins"',
  entries: [
    { key: 'karte.titel', values: { de: 'Karte', en: 'Map' }, changed: false, updatedAt: '2026-01-01' },
  ],
};

describe('OfflineTextCache', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    TestBed.configureTestingModule({});
  });

  it('meldet einen leeren Speicher als null', async () => {
    expect(await TestBed.inject(OfflineTextCache).read()).toBeNull();
  });

  it('hält den Katalog über einen Neustart', async () => {
    await TestBed.inject(OfflineTextCache).write(CATALOGUE);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});

    expect(await TestBed.inject(OfflineTextCache).read()).toEqual(CATALOGUE);
  });
});
