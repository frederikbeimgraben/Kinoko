import { TestBed } from '@angular/core/testing';
import { stubCaches } from '../../testing/cache-storage-double';
import { TILE_CACHE } from './tile-cache';
import { TileStore } from './tile-store';

function store(): TileStore {
  return TestBed.inject(TileStore);
}

function reply(body: string, ok = true): Response {
  return new Response(ok ? body : null, {
    status: ok ? 200 : 404,
    headers: { 'content-type': 'image/png' },
  });
}

/** Die Seite der App, wie ein Ursprung ohne Datei sie schickt. */
function page(): Response {
  return new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });
}

function manifest(body: string): Response {
  return new Response(body, { headers: { 'content-type': 'application/json' } });
}

function setVisible(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('TileStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    stubCaches();
    setVisible('visible');
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
    vi.stubGlobal('fetch', () => Promise.resolve(manifest('{"wochen":2}')));

    expect(await store().json('/art.json')).toEqual({ wochen: 2 });
  });

  it('nimmt die Seite der App weder an noch auf', async () => {
    const caching = stubCaches();
    vi.stubGlobal('fetch', () => Promise.resolve(page()));

    expect(await store().json('/art.json')).toBeNull();
    expect(await caching.match('/art.json')).toBeUndefined();
  });

  it('wirft einen Eintrag mit falschem Inhalt weg und fragt das Netz', async () => {
    const caching = stubCaches();
    await (await caching.open(TILE_CACHE)).put('/art.json', page());
    const fetcher = vi.fn(() => Promise.resolve(manifest('{"wochen":3}')));
    vi.stubGlobal('fetch', fetcher);

    expect(await store().json('/art.json')).toEqual({ wochen: 3 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await (await caching.match('/art.json'))?.text()).toBe('{"wochen":3}');
  });

  it('fragt im Hintergrund nicht das Netz', async () => {
    const fetcher = vi.fn(() => Promise.resolve(reply('kachel')));
    vi.stubGlobal('fetch', fetcher);
    const tiles = store();

    setVisible('hidden');

    expect(await tiles.tile('/a/1/2/3.png')).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('gibt im Hintergrund, was schon liegt', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(reply('kachel')));
    const tiles = store();
    await tiles.tile('/a/1/2/3.png');

    setVisible('hidden');

    expect(await (await tiles.tile('/a/1/2/3.png'))?.text()).toBe('kachel');
  });

  describe('ohne Cache Storage', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({});
      vi.stubGlobal('caches', undefined);
      vi.stubGlobal('fetch', () => Promise.resolve(reply('kachel')));
    });

    it('holt jede Kachel aus dem Netz', async () => {
      expect(await (await store().tile('/a.png'))?.text()).toBe('kachel');
    });
  });
});
