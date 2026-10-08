import { tilePath } from '../core/tiles/tile-paths';
import { covers, type Coverage } from '../core/tiles/coverage';
import { FORECAST_RAMP } from '../ui/ramp/ramp-colours';
import type { CombinationBound, CombinationRule, ValueScale } from './value-colors';
import type { ValueReply, ValueJob } from './value-messages';

/** The part of `Worker` that the protocol uses. Tests can give a small double. */
export interface ColorizeWorker {
  postMessage(job: ValueJob): void;
  addEventListener(kind: 'message', handler: (event: MessageEvent<ValueReply>) => void): void;
  terminate(): void;
}

/** A registered source: its byte scale, its colours and the tiles that exist. */
export interface ValueSource extends Coverage {
  id: string;
  scale: ValueScale;
  colors: readonly string[];
}

export interface CombinationSourcePart extends Coverage {
  folder: string;
  bound: CombinationBound;
}

/** A combined source: many tiles per point, one result. Each change registers it again.
 * The folder in the URL holds the combination id, so MapLibre does not use old tiles. */
export interface CombinationSource {
  id: string;
  rule: CombinationRule;
  colors: readonly string[];
  parts: readonly CombinationSourcePart[];
}

/** MapLibre shows an empty response as a transparent tile. */
const EMPTY = new ArrayBuffer(0);

const PATTERN = /^wert:\/\/([^/]+)\/(.+)\/(\d+)\/(\d+)\/(\d+)$/;

export interface ValueUrl {
  source: string;
  folder: string;
  z: number;
  x: number;
  y: number;
}

export function valueTemplate(source: string, folder: string): string {
  return `wert://${source}/${folder}/{z}/{x}/{y}`;
}

export function parseValueUrl(url: string): ValueUrl | null {
  const matches = PATTERN.exec(url);
  if (!matches) return null;
  return {
    source: matches[1],
    folder: matches[2],
    z: Number(matches[3]),
    x: Number(matches[4]),
    y: Number(matches[5]),
  };
}

export function speciesSource(slug: string, top: number, coverage: Coverage): ValueSource {
  return { id: slug, scale: { kind: 'probability', top }, colors: FORECAST_RAMP, ...coverage };
}

/** The `wert://` protocol for MapLibre. A tile outside the coverage of its source comes back empty, without a 404.
 * The worker fetches and colours all other tiles. */
export class ValueProtocol {
  private readonly worker: ColorizeWorker;
  private readonly sources = new Map<string, ValueSource>();
  private readonly combinations = new Map<string, CombinationSource>();
  private readonly pending = new Map<number, (shot: ImageBitmap | null) => void>();
  private nextId = 0;

  constructor(createWorker: () => ColorizeWorker) {
    this.worker = createWorker();
    this.worker.addEventListener('message', (event) => {
      const reply = event.data;
      const waiter = this.pending.get(reply.id);
      this.pending.delete(reply.id);
      waiter?.(reply.shot);
    });
  }

  report(source: ValueSource): void {
    this.sources.set(source.id, source);
  }

  reportCombination(source: CombinationSource): void {
    this.combinations.set(source.id, source);
  }

  /** The handler for `maplibregl.addProtocol('wert', …)`. */
  readonly resolve = async (url: string): Promise<{ data: ImageBitmap | ArrayBuffer }> => {
    const adresse = parseValueUrl(url);
    if (!adresse) return { data: EMPTY };
    const combination = this.combinations.get(adresse.source);
    if (combination) return { data: (await this.askCombination(combination, adresse)) ?? EMPTY };
    const source = this.sources.get(adresse.source);
    if (!source || !covers(source, adresse.z, adresse.x, adresse.y)) {
      return { data: EMPTY };
    }
    const shot = await this.ask(tilePath(adresse.folder, adresse.z, adresse.x, adresse.y), source);
    return { data: shot ?? EMPTY };
  };

  /** Loads the tiles into the worker cache, so a change of week needs no network. */
  prefetch(sourceId: string, folder: readonly string[], tiles: readonly [number, number, number][]): void {
    const source = this.sources.get(sourceId);
    if (!source) return;
    const urls: string[] = [];
    for (const path of folder) {
      for (const [z, x, y] of tiles) {
        if (covers(source, z, x, y)) urls.push(tilePath(path, z, x, y));
      }
    }
    if (urls.length > 0) this.send({ kind: 'vorladen', urls });
  }

  stop(): void {
    this.worker.terminate();
    this.pending.clear();
  }

  /** All parts must cover the tile. If one part does not, the tile stays empty. */
  private askCombination(source: CombinationSource, adresse: ValueUrl): Promise<ImageBitmap | null> {
    const { z, x, y } = adresse;
    if (source.parts.length === 0 || !source.parts.every((part) => covers(part, z, x, y))) {
      return Promise.resolve(null);
    }
    const parts = source.parts.map((part) => ({
      url: tilePath(part.folder, adresse.z, adresse.x, adresse.y),
      bound: part.bound,
    }));
    return this.dispatch((id) => ({
      kind: 'combination',
      id,
      parts,
      rule: source.rule,
      colors: source.colors,
    }));
  }

  private ask(url: string, source: ValueSource): Promise<ImageBitmap | null> {
    return this.dispatch((id) => ({
      kind: 'faerbe',
      id,
      url,
      scale: source.scale,
      colors: source.colors,
    }));
  }

  private dispatch(create: (id: number) => ValueJob): Promise<ImageBitmap | null> {
    const id = this.nextId++;
    return new Promise<ImageBitmap | null>((done) => {
      this.pending.set(id, done);
      this.send(create(id));
    });
  }

  private send(job: ValueJob): void {
    this.worker.postMessage(job);
  }
}
