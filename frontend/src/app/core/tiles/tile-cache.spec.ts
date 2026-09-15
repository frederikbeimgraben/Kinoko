import { stubCaches } from '../../testing/cache-storage-double';
import { cached, cachedFetch, TILE_CACHE } from './tile-cache';

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
