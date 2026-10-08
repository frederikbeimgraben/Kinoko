import { Injectable, inject } from '@angular/core';
import type { CachedTexts, TextCache } from '../i18n/text-cache';
import { OfflineStore } from './offline-store';

const KEY = 'catalogue';

/** The text catalog on the device. It stays after a restart. */
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
