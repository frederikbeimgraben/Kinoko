import { Injectable } from '@angular/core';
import {
  areaCacheName,
  areaOfCacheName,
  cacheBytes,
  cacheNames,
  cachedFetch,
  dropCache,
  put,
} from './tile-cache';

/** Der Weg der Grundkarte eines Gebiets im Speicher. */
export function pmtilesKey(area: string): string {
  return `/offline/${area}.pmtiles`;
}

/** Wie weit ein Gebiet geladen ist. */
export interface AreaProgress {
  done: number;
  total: number;
}

/**
 * Die Kacheln auf dem Gerät: Grundkarte und Vorhersage je Gebiet und Woche.
 */
@Injectable({ providedIn: 'root' })
export class TileStore {
  /** Holt eine Kachel oder ein Manifest. `null` heißt: nichts zu zeigen. */
  tile(url: string): Promise<Response | null> {
    return cachedFetch(url);
  }

  async json<T>(url: string): Promise<T | null> {
    const reply = await this.tile(url);
    return reply === null ? null : ((await reply.json()) as T);
  }

  /** Legt die Kacheln eines Gebiets ab und meldet den Fortschritt. */
  async pin(
    area: string,
    urls: readonly string[],
    report: (progress: AreaProgress) => void = () => undefined,
  ): Promise<void> {
    const cacheName = areaCacheName(area);
    let done = 0;
    for (const url of urls) {
      await this.store(cacheName, url);
      done += 1;
      report({ done, total: urls.length });
    }
  }

  /** Legt die Grundkarte eines Gebiets ab. */
  async putPmtiles(area: string, file: Blob): Promise<void> {
    await put(areaCacheName(area), pmtilesKey(area), new Response(await file.arrayBuffer()));
  }

  async pmtiles(area: string): Promise<Blob | null> {
    const reply = await this.tile(pmtilesKey(area));
    return reply === null ? null : await reply.blob();
  }

  /** Die Gebiete auf dem Gerät. */
  async areas(): Promise<readonly string[]> {
    const found: string[] = [];
    for (const name of await cacheNames()) {
      const area = areaOfCacheName(name);
      if (area !== null) found.push(area);
    }
    return found;
  }

  bytes(area: string): Promise<number> {
    return cacheBytes(areaCacheName(area));
  }

  remove(area: string): Promise<void> {
    return dropCache(areaCacheName(area));
  }

  private async store(cacheName: string, url: string): Promise<void> {
    let reply: Response;
    try {
      reply = await fetch(url);
    } catch {
      return;
    }
    if (reply.ok) await put(cacheName, url, reply);
  }
}
