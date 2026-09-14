import { Injectable, inject } from '@angular/core';
import { TileStore } from './tile-store';
import { readManifest, type SpeciesManifest } from './manifest';
import { manifestPath } from './tile-paths';

/** Holt die Manifeste über den TileStore: sie liegen neben den Kacheln. */
@Injectable({ providedIn: 'root' })
export class ManifestService {
  private readonly tiles = inject(TileStore);

  // Ein Manifest ändert sich nur beim wöchentlichen Rendering. Innerhalb einer
  // Sitzung wird es darum genau einmal geholt, auch bei parallelen Aufrufen.
  private readonly pending = new Map<string, Promise<SpeciesManifest>>();

  /** Vergisst, was geholt wurde. Der nächste Aufruf fragt den Server erneut. */
  vergiss(): void {
    this.pending.clear();
  }

  get(slug: string): Promise<SpeciesManifest> {
    let run = this.pending.get(slug);
    if (!run) {
      run = this.load(slug);
      this.pending.set(slug, run);
    }
    return run;
  }

  private async load(slug: string): Promise<SpeciesManifest> {
    const content = await this.tiles.json<unknown>(manifestPath(slug));
    if (content === null) {
      this.pending.delete(slug);
      throw new Error(`Manifest ${slug} fehlt`);
    }
    return readManifest(content, slug);
  }
}
