/** The cache of the TileStore: manifests, layers and forecast tiles. */
export const TILE_CACHE = 'primordium-tiles';

/** The expected reply type: JSON for a manifest, an image for a tile. */
export type TileKind = 'json' | 'image';

/** An origin without the file sends the app page. This check rejects that reply. */
export function fits(reply: Response, kind: TileKind): boolean {
  const type = reply.headers.get('content-type') ?? '';
  return kind === 'json' ? type.includes('application/json') : type.startsWith('image/');
}

/** Gives `null` in a context without Cache Storage (no secure origin). */
function storage(): CacheStorage | null {
  return typeof caches === 'undefined' ? null : caches;
}

/** Keeps a reply. On a full device, the tile is not kept. */
async function keep(url: string, reply: Response): Promise<void> {
  const store = storage();
  if (!store) return;
  try {
    const cache = await store.open(TILE_CACHE);
    await cache.put(url, reply);
  } catch {
    return;
  }
}

/** Removes an entry with the wrong content type from the cache. */
async function drop(url: string): Promise<void> {
  const store = storage();
  if (!store) return;
  try {
    const cache = await store.open(TILE_CACHE);
    await cache.delete(url);
  } catch {
    return;
  }
}

/** Gives the reply that is on the device. */
export async function cached(url: string, kind: TileKind): Promise<Response | null> {
  const known = (await storage()?.match(url)) ?? null;
  if (known === null) return null;
  if (fits(known, kind)) return known;
  await drop(url);
  return null;
}

async function fromNetwork(url: string, kind: TileKind): Promise<Response | null> {
  let reply: Response;
  try {
    reply = await fetch(url);
  } catch {
    return null;
  }
  if (!reply.ok || !fits(reply, kind)) return null;
  if (storage()) await keep(url, reply.clone());
  return reply;
}

/** Tile: cache first, then network. Manifest: network first, then cache. */
export async function cachedFetch(url: string, kind: TileKind): Promise<Response | null> {
  if (kind === 'json') return (await fromNetwork(url, kind)) ?? cached(url, kind);
  return (await cached(url, kind)) ?? fromNetwork(url, kind);
}
