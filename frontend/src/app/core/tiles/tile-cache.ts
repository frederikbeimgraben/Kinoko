/** Was der TileStore hält: Manifeste, Ebenen und Vorhersagekacheln. */
export const TILE_CACHE = 'primordium-tiles';

/** Ein Kontext ohne Cache Storage (kein sicherer Ursprung) liefert `null`. */
function storage(): CacheStorage | null {
  return typeof caches === 'undefined' ? null : caches;
}

/** Legt eine Antwort ab. Ein volles Gerät lässt die Kachel eben nicht liegen. */
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

/** Was schon auf dem Gerät liegt. */
export async function cached(url: string): Promise<Response | null> {
  return (await storage()?.match(url)) ?? null;
}

/** Holt eine Kachel. Der Speicher führt, das Netz ist der Rückfall. */
export async function cachedFetch(url: string): Promise<Response | null> {
  const known = await cached(url);
  if (known) return known;
  let reply: Response;
  try {
    reply = await fetch(url);
  } catch {
    return null;
  }
  if (!reply.ok) return null;
  if (storage()) await keep(url, reply.clone());
  return reply;
}
