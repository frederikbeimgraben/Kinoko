import { Injectable, inject } from '@angular/core';
import { VisibilityService } from '../visibility/visibility.service';
import { cached, cachedFetch, type TileKind } from './tile-cache';

/**
 * Kacheln und Manifeste vom Gerät. Im Hintergrund geht nichts ins Netz.
 */
@Injectable({ providedIn: 'root' })
export class TileStore {
  private readonly visibility = inject(VisibilityService);

  /** Holt eine Kachel. `null` heißt: nichts zu zeigen. */
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
