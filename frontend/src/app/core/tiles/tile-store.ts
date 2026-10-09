import { Injectable, inject } from '@angular/core';
import { VisibilityService } from '../visibility/visibility.service';
import { cached, cachedFetch, fetchManifest, type ManifestReply } from './tile-cache';

/** Tiles and manifests from the device. A hidden page makes no network requests. */
@Injectable({ providedIn: 'root' })
export class TileStore {
  private readonly visibility = inject(VisibilityService);

  /** Gets a tile. `null` means that there is nothing to show. */
  tile(url: string): Promise<Response | null> {
    return this.visibility.visible() ? cachedFetch(url, 'image') : cached(url, 'image');
  }

  /** Gets a manifest. The reply tells apart a file that is not at the origin and an origin that does not reply. */
  manifest(url: string): Promise<ManifestReply> {
    return fetchManifest(url, this.visibility.visible());
  }
}
