/** Was ohne Gebiet geholt wurde. Es darf jederzeit weg. */
export const TILE_CACHE = 'primordium-tiles';

/** Jedes Gebiet hat einen eigenen Speicher, damit es als Ganzes weggeht. */
export const AREA_PREFIX = 'primordium-area-';

export function areaCacheName(area: string): string {
  return `${AREA_PREFIX}${area}`;
}

export function areaOfCacheName(name: string): string | null {
  return name.startsWith(AREA_PREFIX) ? name.slice(AREA_PREFIX.length) : null;
}

/** Ein Kontext ohne Cache Storage (kein sicherer Ursprung) liefert `null`. */
function storage(): CacheStorage | null {
  return typeof caches === 'undefined' ? null : caches;
}

/** Holt eine Kachel. Der Speicher führt, das Netz ist der Rückfall. */
export async function cachedFetch(url: string): Promise<Response | null> {
  const store = storage();
  const known = await store?.match(url);
  if (known) return known;
  let reply: Response;
  try {
    reply = await fetch(url);
  } catch {
    return null;
  }
  if (!reply.ok) return null;
  if (store) await put(TILE_CACHE, url, reply.clone());
  return reply;
}

/** Legt eine Antwort in einen benannten Speicher. */
export async function put(cacheName: string, url: string, reply: Response): Promise<void> {
  const store = storage();
  if (!store) return;
  try {
    const cache = await store.open(cacheName);
    await cache.put(url, reply);
  } catch {
    // Ein volles Gerät lässt die Kachel eben nicht liegen.
  }
}

/** Die Namen aller Speicher der App. */
export async function cacheNames(): Promise<readonly string[]> {
  return (await storage()?.keys()) ?? [];
}

export async function dropCache(cacheName: string): Promise<void> {
  await storage()?.delete(cacheName);
}

/** Die Größe eines Speichers in Bytes. */
export async function cacheBytes(cacheName: string): Promise<number> {
  const store = storage();
  if (!store || !(await store.has(cacheName))) return 0;
  const cache = await store.open(cacheName);
  let bytes = 0;
  for (const request of await cache.keys()) {
    const reply = await cache.match(request);
    if (reply) bytes += (await reply.blob()).size;
  }
  return bytes;
}
