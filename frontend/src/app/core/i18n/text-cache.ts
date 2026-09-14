import { InjectionToken } from '@angular/core';
import type { TextEntry } from '../api/models';

/** Der geholte Katalog mit dem ETag, unter dem er kam. */
export interface CachedTexts {
  etag: string | null;
  entries: readonly TextEntry[];
}

/** Der Ablageort des Katalogs zwischen zwei Starts. */
export interface TextCache {
  read(): Promise<CachedTexts | null>;
  write(value: CachedTexts): Promise<void>;
}

/** Der Katalog im Arbeitsspeicher: er trägt nur durch diese Sitzung. */
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
