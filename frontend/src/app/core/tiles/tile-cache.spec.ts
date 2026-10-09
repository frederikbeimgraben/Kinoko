import { stubCaches } from '../../testing/cache-storage-double';
import { cached, cachedFetch, fetchManifest, TILE_CACHE } from './tile-cache';

function image(body: string): Response {
  return new Response(body, { headers: { 'content-type': 'image/png' } });
}

function manifest(body: string): Response {
  return new Response(body, { headers: { 'content-type': 'application/json' } });
}

describe('cachedFetch', () => {
  it('holt eine Kachel zuerst aus dem Speicher, das Netz bleibt aus', async () => {
    const caching = stubCaches();
    await (await caching.open(TILE_CACHE)).put('/a/1/2/3.png', image('alt'));
    const fetcher = vi.fn(() => Promise.resolve(image('neu')));
    vi.stubGlobal('fetch', fetcher);

    const reply = await cachedFetch('/a/1/2/3.png', 'image');

    expect(await reply?.text()).toBe('alt');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('holt ein Manifest zuerst aus dem Netz und legt den frischen Stand ab', async () => {
    const caching = stubCaches();
    await (await caching.open(TILE_CACHE)).put('/art.json', manifest('{"weeks":1}'));
    vi.stubGlobal('fetch', () => Promise.resolve(manifest('{"weeks":2}')));

    const reply = await cachedFetch('/art.json', 'json');

    expect(await reply?.text()).toBe('{"weeks":2}');
    expect(await (await cached('/art.json', 'json'))?.text()).toBe('{"weeks":2}');
  });

  it('fällt bei einem Netzfehler auf das gespeicherte Manifest zurück', async () => {
    const caching = stubCaches();
    await (await caching.open(TILE_CACHE)).put('/art.json', manifest('{"weeks":1}'));
    vi.stubGlobal('fetch', () => Promise.reject(new Error('kein Netz')));

    const reply = await cachedFetch('/art.json', 'json');

    expect(await reply?.text()).toBe('{"weeks":1}');
  });

  it('fällt bei einer Fehlerantwort auf das gespeicherte Manifest zurück', async () => {
    const caching = stubCaches();
    await (await caching.open(TILE_CACHE)).put('/art.json', manifest('{"weeks":1}'));
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(null, { status: 500 })));

    const reply = await cachedFetch('/art.json', 'json');

    expect(await reply?.text()).toBe('{"weeks":1}');
  });

  it('meldet ein Manifest ohne Netz und ohne Speicher als null', async () => {
    stubCaches();
    vi.stubGlobal('fetch', () => Promise.reject(new Error('kein Netz')));

    expect(await cachedFetch('/art.json', 'json')).toBeNull();
  });
});

/** The app page, as an origin without the file sends it with status 200. */
function page(): Response {
  return new Response('<!doctype html><html></html>', { headers: { 'content-type': 'text/html' } });
}

describe('fetchManifest', () => {
  it('gibt den Inhalt und legt ihn ab', async () => {
    stubCaches();
    vi.stubGlobal('fetch', () => Promise.resolve(manifest('{"weeks":2}')));

    expect(await fetchManifest('/art.json', true)).toEqual({ kind: 'data', content: { weeks: 2 } });
    expect(await (await cached('/art.json', 'json'))?.text()).toBe('{"weeks":2}');
  });

  it('meldet 404 als fehlend und wirft die alte Kopie weg', async () => {
    const caching = stubCaches();
    await (await caching.open(TILE_CACHE)).put('/art.json', manifest('{"weeks":1}'));
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(null, { status: 404 })));

    expect(await fetchManifest('/art.json', true)).toEqual({ kind: 'missing' });
    expect(await cached('/art.json', 'json')).toBeNull();
  });

  it('meldet die Seite der App mit Status 200 wie 404 als fehlend', async () => {
    const caching = stubCaches();
    await (await caching.open(TILE_CACHE)).put('/art.json', manifest('{"weeks":1}'));
    vi.stubGlobal('fetch', () => Promise.resolve(page()));

    expect(await fetchManifest('/art.json', true)).toEqual({ kind: 'missing' });
    expect(await cached('/art.json', 'json')).toBeNull();
  });

  it('meldet einen Inhalt, der kein JSON-Objekt ist, als fehlend', async () => {
    stubCaches();
    vi.stubGlobal('fetch', () => Promise.resolve(manifest('<!doctype html>')));
    expect(await fetchManifest('/art.json', true)).toEqual({ kind: 'missing' });

    vi.stubGlobal('fetch', () => Promise.resolve(manifest('null')));
    expect(await fetchManifest('/art.json', true)).toEqual({ kind: 'missing' });
    expect(await cached('/art.json', 'json')).toBeNull();
  });

  it('fällt bei Netzfehler und Serverfehler auf die Kopie zurück', async () => {
    const caching = stubCaches();
    await (await caching.open(TILE_CACHE)).put('/art.json', manifest('{"weeks":1}'));

    vi.stubGlobal('fetch', () => Promise.reject(new Error('kein Netz')));
    expect(await fetchManifest('/art.json', true)).toEqual({ kind: 'data', content: { weeks: 1 } });

    vi.stubGlobal('fetch', () => Promise.resolve(new Response(null, { status: 502 })));
    expect(await fetchManifest('/art.json', true)).toEqual({ kind: 'data', content: { weeks: 1 } });
  });

  it('meldet ohne Antwort und ohne Kopie: nicht erreichbar', async () => {
    stubCaches();
    vi.stubGlobal('fetch', () => Promise.reject(new Error('kein Netz')));
    expect(await fetchManifest('/art.json', true)).toEqual({ kind: 'unreachable' });

    vi.stubGlobal('fetch', () => Promise.resolve(new Response(null, { status: 503 })));
    expect(await fetchManifest('/art.json', true)).toEqual({ kind: 'unreachable' });
  });

  it('wirft eine kaputte Kopie weg', async () => {
    const caching = stubCaches();
    await (await caching.open(TILE_CACHE)).put('/art.json', manifest('{kaputt'));

    expect(await fetchManifest('/art.json', false)).toEqual({ kind: 'unreachable' });
    expect(await caching.match('/art.json')).toBeUndefined();
  });
});
