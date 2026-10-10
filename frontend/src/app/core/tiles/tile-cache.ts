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

/** The result of a manifest load. */
export type ManifestReply =
  | { readonly kind: 'data'; readonly content: unknown }
  // A 404, or a reply that is not JSON (for example the app page) and no copy on the device.
  | { readonly kind: 'missing' }
  // No reply from the origin and no copy on the device.
  | { readonly kind: 'unreachable' };

const MISSING: ManifestReply = { kind: 'missing' };
const UNREACHABLE: ManifestReply = { kind: 'unreachable' };

/** A reply that tells that the file is not at the origin. */
function absent(reply: Response): boolean {
  return reply.status === 404 || reply.status === 410;
}

/** Reads the body as a JSON object. A body that is not a JSON object gives `MISSING`. */
async function parse(reply: Response): Promise<ManifestReply> {
  let content: unknown;
  try {
    content = await reply.json();
  } catch {
    return MISSING;
  }
  return typeof content === 'object' && content !== null ? { kind: 'data', content } : MISSING;
}

/** The copy of a manifest on the device. A copy that is not JSON is removed. */
async function storedManifest(url: string): Promise<ManifestReply> {
  const known = await cached(url, 'json');
  if (known === null) return UNREACHABLE;
  const read = await parse(known);
  if (read.kind === 'data') return read;
  await drop(url);
  return UNREACHABLE;
}

/** Loads a manifest: network first, then the copy on the device. Without `online`, only the copy. */
export async function fetchManifest(url: string, online: boolean): Promise<ManifestReply> {
  if (!online) return storedManifest(url);
  let reply: Response;
  try {
    reply = await fetch(url);
  } catch {
    return storedManifest(url);
  }
  if (absent(reply)) {
    // The origin has no such file, so an old copy shows data that is gone.
    await drop(url);
    return MISSING;
  }
  if (!reply.ok) return storedManifest(url);
  // A captive portal or a proxy can also send a page that is not JSON, so the copy stays.
  if (!fits(reply, 'json')) return copyOrMissing(url);
  const copy = reply.clone();
  const read = await parse(reply);
  if (read.kind !== 'data') return copyOrMissing(url);
  await keep(url, copy);
  return read;
}

/** The copy on the device, or `MISSING` when there is none. */
async function copyOrMissing(url: string): Promise<ManifestReply> {
  const stored = await storedManifest(url);
  return stored.kind === 'unreachable' ? MISSING : stored;
}
