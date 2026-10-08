import { Injectable, computed, inject, signal } from '@angular/core';
import { ConfigStore } from '../config/config.store';
import { TileStore } from './tile-store';
import { readLayers, type Layer, type LayersManifest } from './layers';
import { readManifest, type SpeciesManifest } from './manifest';
import { layerFromSpecies } from './species-as-layer';
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

  /** Loads a manifest one time. The service does not keep a failure, so the next call tries again. */
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
  }

  private async loadManifest(slug: string): Promise<void> {
    const content = await this.store.json<unknown>(this.url(manifestPath(slug))).catch(() => null);
    if (content === null) {
      this.running.delete(slug);
      return;
    }
    const manifest = readManifest(content, slug);
    this._manifests.update((known) => new Map(known).set(slug, manifest));
  }

  private async loadLayerManifest(): Promise<void> {
    const content = await this.store.json<unknown>(this.url(LAYERS_MANIFEST)).catch(() => null);
    if (content === null) {
      this.running.delete(LAYERS_MANIFEST);
      return;
    }
    this._layers.set(readLayers(content));
  }
}
