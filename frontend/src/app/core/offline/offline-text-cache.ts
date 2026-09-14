import { Injectable, inject } from '@angular/core';
import type { CachedTexts, TextCache } from '../i18n/text-cache';
import { OfflineStore } from './offline-store';

const KEY = 'catalogue';

/** Der Textkatalog auf dem Gerät. Er übersteht den Neustart. */
@Injectable({ providedIn: 'root' })
export class OfflineTextCache implements TextCache {
  private readonly store = inject(OfflineStore);

  read(): Promise<CachedTexts | null> {
    return this.store.get<CachedTexts>('texts', KEY);
  }

  async write(value: CachedTexts): Promise<void> {
    await this.store.put('texts', KEY, value);
  }
}
