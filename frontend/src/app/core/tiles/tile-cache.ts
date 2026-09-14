/** Was der TileStore hält: Manifeste, Ebenen und Vorhersagekacheln. */
export const TILE_CACHE = 'primordium-tiles';

/** Was eine Antwort tragen muss: ein Manifest JSON, eine Kachel ein Bild. */
export type TileKind = 'json' | 'image';

/** Ein Ursprung ohne Datei schickt die Seite der App. Sie zählt nicht. */
export function fits(reply: Response, kind: TileKind): boolean {
  const type = reply.headers.get('content-type') ?? '';
  return kind === 'json' ? type.includes('application/json') : type.startsWith('image/');
}

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

/** Nimmt einen Eintrag mit falschem Inhalt aus dem Speicher. */
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

/** Was schon auf dem Gerät liegt. */
export async function cached(url: string, kind: TileKind): Promise<Response | null> {
  const known = (await storage()?.match(url)) ?? null;
  if (known === null) return null;
  if (fits(known, kind)) return known;
  await drop(url);
  return null;
}

/** Holt eine Kachel. Der Speicher führt, das Netz ist der Rückfall. */
export async function cachedFetch(url: string, kind: TileKind): Promise<Response | null> {
  const known = await cached(url, kind);
  if (known) return known;
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
