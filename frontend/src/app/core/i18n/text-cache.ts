import { InjectionToken } from '@angular/core';
import type { TextEntry } from '../api/models';

/** The loaded catalogue with its ETag. */
export interface CachedTexts {
  etag: string | null;
  entries: readonly TextEntry[];
}

/** Keeps the catalogue between two app starts. */
export interface TextCache {
  read(): Promise<CachedTexts | null>;
  write(value: CachedTexts): Promise<void>;
}

/** Keeps the catalogue in memory, for this session only. */
export class MemoryTextCache implements TextCache {
  private held: CachedTexts | null = null;

  read(): Promise<CachedTexts | null> {
    return Promise.resolve(this.held);
  }

  write(value: CachedTexts): Promise<void> {
    this.held = value;
    return Promise.resolve();
  }
}

export const TEXT_CACHE = new InjectionToken<TextCache>('TEXT_CACHE', {
  providedIn: 'root',
  factory: () => new MemoryTextCache(),
});
