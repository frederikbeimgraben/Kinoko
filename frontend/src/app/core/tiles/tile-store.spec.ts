import { TestBed } from '@angular/core/testing';
import { stubCaches } from '../../testing/cache-storage-double';
import { TileStore, pmtilesKey } from './tile-store';

function store(): TileStore {
  return TestBed.inject(TileStore);
}

function reply(body: string, ok = true): Response {
  return new Response(ok ? body : null, { status: ok ? 200 : 404 });
}

describe('TileStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    stubCaches();
  });

  it('holt eine Kachel aus dem Netz und legt sie ab', async () => {
    const fetcher = vi.fn(() => Promise.resolve(reply('kachel')));
    vi.stubGlobal('fetch', fetcher);
    const tiles = store();

    expect(await (await tiles.tile('/a/1/2/3.png'))?.text()).toBe('kachel');
    expect(await (await tiles.tile('/a/1/2/3.png'))?.text()).toBe('kachel');

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('meldet eine fehlende Kachel als null', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(reply('', false)));

    expect(await store().tile('/weg.png')).toBeNull();
    expect(await store().json('/weg.json')).toBeNull();
  });

  it('meldet einen Netzfehler als null', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('kein Netz')));

    expect(await store().tile('/weg.png')).toBeNull();
  });

  it('liest ein Manifest als JSON', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('{"wochen":2}')));

    expect(await store().json('/art.json')).toEqual({ wochen: 2 });
  });

  it('legt ein Gebiet ab, nennt seine Größe und räumt es weg', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(reply('1234567890')));
    const tiles = store();

    await tiles.pin('schwarzwald', ['/a/1.png', '/a/2.png']);

    expect(await tiles.areas()).toEqual(['schwarzwald']);
    expect(await tiles.bytes('schwarzwald')).toBe(20);

    await tiles.remove('schwarzwald');
    expect(await tiles.areas()).toEqual([]);
    expect(await tiles.bytes('schwarzwald')).toBe(0);
  });

  it('meldet den Fortschritt eines Gebiets', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(reply('x')));
    const steps: number[] = [];

    await store().pin('pfalz', ['/a/1.png', '/a/2.png'], (progress) => steps.push(progress.done));

    expect(steps).toEqual([1, 2]);
  });

  it('überspringt eine Kachel, die nicht kommt', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('kein Netz')));

    await store().pin('pfalz', ['/a/1.png']);

    expect(await store().bytes('pfalz')).toBe(0);
  });

  it('legt die Grundkarte eines Gebiets ab', async () => {
    const tiles = store();

    await tiles.putPmtiles('pfalz', new Blob(['karte']));

    expect(pmtilesKey('pfalz')).toBe('/offline/pfalz.pmtiles');
    expect(await (await tiles.pmtiles('pfalz'))?.text()).toBe('karte');
  });

  describe('ohne Cache Storage', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({});
      vi.stubGlobal('caches', undefined);
      vi.stubGlobal('fetch', () => Promise.resolve(reply('kachel')));
    });

    it('holt jede Kachel aus dem Netz und kennt kein Gebiet', async () => {
      const tiles = store();

      expect(await (await tiles.tile('/a.png'))?.text()).toBe('kachel');
      expect(await tiles.areas()).toEqual([]);
      expect(await tiles.bytes('pfalz')).toBe(0);
      await tiles.remove('pfalz');
    });
  });
});
