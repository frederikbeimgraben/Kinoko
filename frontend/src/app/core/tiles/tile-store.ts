import { Injectable, inject } from '@angular/core';
import { VisibilityService } from '../visibility/visibility.service';
import { cached, cachedFetch } from './tile-cache';

/**
 * Kacheln und Manifeste vom Gerät. Im Hintergrund geht nichts ins Netz.
 */
@Injectable({ providedIn: 'root' })
export class TileStore {
  private readonly visibility = inject(VisibilityService);

  /** Holt eine Kachel oder ein Manifest. `null` heißt: nichts zu zeigen. */
  tile(url: string): Promise<Response | null> {
    return this.visibility.visible() ? cachedFetch(url) : cached(url);
  }

  async json<T>(url: string): Promise<T | null> {
    const reply = await this.tile(url);
    return reply === null ? null : ((await reply.json()) as T);
  }
}
