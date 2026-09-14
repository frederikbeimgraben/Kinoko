import { Injectable, inject } from '@angular/core';
import { TileStore } from './tile-store';
import { LAYERS_MANIFEST } from './tile-paths';
import { readLayers, type LayersManifest } from './layers';

/** Holt `layers.json` über den TileStore: die Datei liegt neben den Kacheln. */
@Injectable({ providedIn: 'root' })
export class LayersService {
  private readonly tiles = inject(TileStore);

  // Das Manifest ändert sich nur beim wöchentlichen Rendering. Innerhalb einer
  // Sitzung wird es darum genau einmal geholt, auch bei parallelen Aufrufen.
  private pending: Promise<LayersManifest> | null = null;

  /** Vergisst, was geholt wurde. Der nächste Aufruf fragt den Server erneut. */
  vergiss(): void {
    this.pending = null;
  }

  get(): Promise<LayersManifest> {
    this.pending ??= this.load();
    return this.pending;
  }

  private async load(): Promise<LayersManifest> {
    const content = await this.tiles.json<unknown>(LAYERS_MANIFEST);
    if (content === null) {
      this.pending = null;
      throw new Error('Ebenen fehlen');
    }
    return readLayers(content);
  }
}
