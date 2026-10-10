import { Injectable, computed, inject, signal } from '@angular/core';
import { ConfigStore } from '../config/config.store';
import { TileStore } from './tile-store';
import { readLayers, type Layer, type LayersManifest } from './layers';
import { readManifest, type SpeciesManifest } from './manifest';
import { layerFromSpecies } from './species-as-layer';
import type { ManifestReply } from './tile-cache';
import { LAYERS_MANIFEST, manifestPath } from './tile-paths';

/** The manifests and the tiles. `Config` gives the origin. The tiles are static files. */
@Injectable({ providedIn: 'root' })
export class TileService {
  private readonly store = inject(TileStore);
  private readonly config = inject(ConfigStore);

  private readonly running = new Map<string, Promise<void>>();
  private readonly _manifests = signal<ReadonlyMap<string, SpeciesManifest>>(new Map());
  private readonly _layers = signal<LayersManifest | null>(null);

  /** The loaded species manifests, by slug. */
  readonly manifests = this._manifests.asReadonly();
  readonly layers = this._layers.asReadonly();

  private readonly _failed = signal<ReadonlySet<string>>(new Set());
  /** The manifests whose origin did not reply at the last load: species slugs and the layers manifest. */
  readonly failed = this._failed.asReadonly();

  private readonly _missing = signal<ReadonlySet<string>>(new Set());
  /** The manifests that are not at the origin (404, or a reply that is not JSON): species slugs and the layers manifest. */
  readonly missing = this._missing.asReadonly();

  /** The input layers. The list is empty until the manifest loads. */
  readonly layerList = computed<readonly Layer[]>(() => this._layers()?.layers ?? []);

  /** The path of a file next to the tiles, at the origin from `Config`. */
  url(path: string): string {
    const origin = this.config.configuration()?.origin ?? '';
    return origin === '' ? path : `${origin.replace(/\/$/, '')}${path}`;
  }

  manifestOf(slug: string): SpeciesManifest | null {
    return this._manifests().get(slug) ?? null;
  }

  /** A species as an input layer, so that it can be a factor. */
  speciesLayer(slug: string, label: string): Layer | null {
    const manifest = this.manifestOf(slug);
    return manifest === null ? null : layerFromSpecies(manifest, label);
  }

  /** Loads a manifest one time. The service does not keep a failure or a missing file, so the next call tries again. */
  load(slug: string): Promise<void> {
    let run = this.running.get(slug);
    if (!run) {
      run = this.loadManifest(slug);
      this.running.set(slug, run);
    }
    return run;
  }

  loadLayers(): Promise<void> {
    let run = this.running.get(LAYERS_MANIFEST);
    if (!run) {
      run = this.loadLayerManifest();
      this.running.set(LAYERS_MANIFEST, run);
    }
    return run;
  }

  /** Forgets all loads. The next call asks the server again. */
  forget(): void {
    this.running.clear();
    this._failed.set(new Set());
    this._missing.set(new Set());
  }

  /** Tells if the last load of the layers manifest failed. */
  layersFailed(): boolean {
    return this._failed().has(LAYERS_MANIFEST);
  }

  /** Tells if the layers manifest is not at the origin. */
  layersMissing(): boolean {
    return this._missing().has(LAYERS_MANIFEST);
  }

  /** Records the result of a load in `failed` and `missing`. */
  private mark(key: string, reply: ManifestReply): void {
    const flag = (known: ReadonlySet<string>, on: boolean): ReadonlySet<string> => {
      if (known.has(key) === on) return known;
      const next = new Set(known);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    };
    this._failed.update((known) => flag(known, reply.kind === 'unreachable'));
    this._missing.update((known) => flag(known, reply.kind === 'missing'));
  }

  /** Loads a manifest file. Without content, the next call asks the origin again. */
  private async read(key: string, path: string): Promise<unknown> {
    const reply = await this.store
      .manifest(this.url(path))
      .catch((): ManifestReply => ({ kind: 'unreachable' }));
    this.mark(key, reply);
    if (reply.kind === 'data') return reply.content;
    this.running.delete(key);
    return null;
  }

  private async loadManifest(slug: string): Promise<void> {
    const content = await this.read(slug, manifestPath(slug));
    if (content === null) return;
    const manifest = readManifest(content, slug);
    this._manifests.update((known) => new Map(known).set(slug, manifest));
  }

  private async loadLayerManifest(): Promise<void> {
    const content = await this.read(LAYERS_MANIFEST, LAYERS_MANIFEST);
    if (content === null) return;
    this._layers.set(readLayers(content));
  }
}
