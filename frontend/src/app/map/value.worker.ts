import {
  createCombinationLut,
  createLut,
  colorize,
  combinationIndex,
  combine,
  scaleKey,
  type CombinationBound,
  type ValueScale,
} from './value-colors';
import { TileCache } from './value-cache';
import type { ColorizeJob, CombinationJob, PrefetchJob, ValueReply, ValueJob } from './value-messages';

/** The name must match `core/tiles/tile-cache.ts`. */
const TILE_CACHE = 'primordium-tiles';

/** 16 MB holds about 500 raw tiles: several weeks of the visible area. */
const CACHE_LIMIT = 16 * 1024 * 1024;

const cache = new TileCache(CACHE_LIMIT);
// A table depends only on scale and ramp, so each one is built once.
const tables = new Map<string, Uint8ClampedArray>();

// The DOM types give `self` the window signature. This narrow type
// gives the worker scope without a separate lib target.
interface WorkerScope {
  postMessage(reply: ValueReply, transfer: Transferable[]): void;
  addEventListener(kind: 'message', handler: (event: MessageEvent<ValueJob>) => void): void;
}

/** A decoded tile and its canvas. The result goes back into the same pixels and canvas.
 * A second canvas costs a quarter megabyte per tile for no gain. */
interface Tile {
  shot: ImageData;
  canvas: OffscreenCanvas;
  pen: OffscreenCanvasRenderingContext2D;
}

function table(schluessel: string, create: () => Uint8ClampedArray): Uint8ClampedArray {
  let lut = tables.get(schluessel);
  if (!lut) {
    lut = create();
    tables.set(schluessel, lut);
  }
  return lut;
}

/** The in-memory cache comes first. A missing tile shows nothing. */
async function get(url: string): Promise<ArrayBuffer | null> {
  const known = cache.get(url);
  if (known !== undefined) return known;
  const content = await fromStore(url);
  cache.put(url, content);
  return content;
}

/** A tile is an image. The app page (a fallback response) is not. */
function isImage(reply: Response): boolean {
  return (reply.headers.get('content-type') ?? '').startsWith('image/');
}

/** The same Cache Storage as in the window, without Angular. */
async function fromStore(url: string): Promise<ArrayBuffer | null> {
  const store = typeof caches === 'undefined' ? null : caches;
  try {
    const stored = await store?.match(url);
    if (stored && isImage(stored)) return await stored.arrayBuffer();
    if (stored && store) await (await store.open(TILE_CACHE)).delete(url);
    const reply = await fetch(url);
    if (!reply.ok || !isImage(reply)) return null;
    if (store) await (await store.open(TILE_CACHE)).put(url, reply.clone());
    return await reply.arrayBuffer();
  } catch {
    return null;
  }
}

/** The red channel of the decoded tile holds the byte. */
async function unpack(url: string): Promise<Tile | null> {
  const content = await get(url);
  if (content === null || content.byteLength === 0) return null;
  const grey = await createImageBitmap(new Blob([content], { type: 'image/png' }));
  const canvas = new OffscreenCanvas(grey.width, grey.height);
  const pen = canvas.getContext('2d', { willReadFrequently: true });
  if (!pen) return null;
  pen.drawImage(grey, 0, 0);
  grey.close();
  return { shot: pen.getImageData(0, 0, canvas.width, canvas.height), canvas, pen };
}

function draw(tile: Tile): ImageBitmap {
  tile.pen.putImageData(tile.shot, 0, 0);
  return tile.canvas.transferToImageBitmap();
}

export async function colorizeTile(
  url: string,
  scale: ValueScale,
  colors: readonly string[],
): Promise<ImageBitmap | null> {
  const tile = await unpack(url);
  if (!tile) return null;
  colorize(
    tile.shot.data,
    table(scaleKey(scale, colors), () => createLut(scale, colors)),
  );
  return draw(tile);
}

/** A tile from many sources. If one source has no tile, the full tile stays empty. */
export async function combineTile(job: CombinationJob): Promise<ImageBitmap | null> {
  const fetched = await Promise.all(job.parts.map((part) => unpack(part.url)));
  const tiles = fetched.filter((tile): tile is Tile => tile !== null);
  const first = tiles[0] as Tile | undefined;
  if (!first || tiles.length !== fetched.length) return null;
  const bounds: CombinationBound[] = job.parts.map((part) => part.bound);
  const lut = table(`kombi|${job.rule}|${job.colors.join(',')}`, () =>
    createCombinationLut(job.colors, job.rule),
  );
  // The result goes into the first tile. Each byte is read before
  // it is written, so the overwrite is safe.
  const sources = tiles.map((tile) => tile.shot.data);
  const target = first.shot.data;
  const bytes = new Array<number>(sources.length);
  for (let i = 0; i < target.length; i += 4) {
    for (let part = 0; part < sources.length; part++) bytes[part] = sources[part][i];
    const value = combine(bytes, bounds, job.rule);
    const entry = value < 0 ? 0 : combinationIndex(value) * 4;
    target[i] = lut[entry];
    target[i + 1] = lut[entry + 1];
    target[i + 2] = lut[entry + 2];
    target[i + 3] = lut[entry + 3];
  }
  return draw(first);
}

async function answerJob(range: WorkerScope, job: ColorizeJob | CombinationJob): Promise<void> {
  const shot =
    job.kind === 'faerbe' ? await colorizeTile(job.url, job.scale, job.colors) : await combineTile(job);
  range.postMessage({ id: job.id, shot }, shot ? [shot] : []);
}

/** Puts the next weeks into the cache. No reply is necessary. */
async function load(job: PrefetchJob): Promise<void> {
  for (const url of job.urls) await get(url);
}

export function takeJobs(range: WorkerScope): void {
  range.addEventListener('message', (event) => {
    const job = event.data;
    void (job.kind === 'vorladen' ? load(job) : answerJob(range, job));
  });
}

takeJobs(self as unknown as WorkerScope);
