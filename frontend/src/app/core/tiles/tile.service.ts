import { Injectable, computed, inject, signal } from '@angular/core';
import { ConfigService } from '../config/config.service';
import { TileStore } from './tile-store';
import { readLayers, type Layer, type LayersManifest } from './layers';
import { readManifest, type SpeciesManifest } from './manifest';
import { layerFromSpecies } from './species-as-layer';
import { LAYERS_MANIFEST, manifestPath } from './tile-paths';

/** Manifeste und Kacheln. Der Ursprung steht in `Config`, die Kacheln liegen statisch. */
@Injectable({ providedIn: 'root' })
export class TileService {
  private readonly store = inject(TileStore);
  private readonly config = inject(ConfigService);

  private readonly running = new Map<string, Promise<void>>();
  private readonly _manifests = signal<ReadonlyMap<string, SpeciesManifest>>(new Map());
  private readonly _layers = signal<LayersManifest | null>(null);

  /** Die geladenen Art-Manifeste, nach Slug. */
  readonly manifests = this._manifests.asReadonly();
  readonly layers = this._layers.asReadonly();

  /** Die Eingabe-Ebenen, leer solange nichts geladen ist. */
  readonly layerList = computed<readonly Layer[]>(() => this._layers()?.layers ?? []);

  /** Der Weg einer Datei neben den Kacheln, am Ursprung aus `Config`. */
  url(path: string): string {
    const origin = this.config.configuration()?.origin ?? '';
    return origin === '' ? path : `${origin.replace(/\/$/, '')}${path}`;
  }

  manifestOf(slug: string): SpeciesManifest | null {
    return this._manifests().get(slug) ?? null;
  }

  /** Eine Art als Eingabe-Ebene, damit sie als Faktor taugt. */
  speciesLayer(slug: string, label: string): Layer | null {
    const manifest = this.manifestOf(slug);
    return manifest === null ? null : layerFromSpecies(manifest, label);
  }

  /** Holt ein Manifest genau einmal. Ein Fehlschlag wird nicht gemerkt. */
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

  /** Vergisst alles. Der nächste Aufruf fragt den Server erneut. */
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
