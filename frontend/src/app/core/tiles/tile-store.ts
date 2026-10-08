import { Injectable, inject } from '@angular/core';
import { VisibilityService } from '../visibility/visibility.service';
import { cached, cachedFetch, type TileKind } from './tile-cache';

/** Tiles and manifests from the device. A hidden page makes no network requests. */
@Injectable({ providedIn: 'root' })
export class TileStore {
  private readonly visibility = inject(VisibilityService);

  /** Gets a tile. `null` means that there is nothing to show. */
  tile(url: string): Promise<Response | null> {
    return this.load(url, 'image');
  }

  async json<T>(url: string): Promise<T | null> {
    const reply = await this.load(url, 'json');
    return reply === null ? null : ((await reply.json()) as T);
  }

  private load(url: string, kind: TileKind): Promise<Response | null> {
    return this.visibility.visible() ? cachedFetch(url, kind) : cached(url, kind);
  }
}
