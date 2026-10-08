import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TextsApi } from '../api/texts.api';
import type { TextEntry } from '../api/models';
import { I18nService, type LoadedTexts } from './i18n.service';
import { TEXT_CACHE, type CachedTexts } from './text-cache';
import type { Locale } from './translations';

/** Makes one dictionary for each language from the entries, for the `I18nService`. */
export function textsOf(entries: readonly TextEntry[]): LoadedTexts {
  const texts: Partial<Record<Locale, Record<string, string>>> = {};
  for (const entry of entries) {
    for (const [locale, value] of Object.entries(entry.values) as [Locale, string][]) {
      (texts[locale] ??= {})[entry.key] = value;
    }
  }
  return texts;
}

/** The texts from the database: first from the `TextCache`, then from the server. */
@Injectable({ providedIn: 'root' })
export class TextCatalogService {
  private readonly api = inject(TextsApi);
  private readonly i18n = inject(I18nService);
  private readonly cache = inject(TEXT_CACHE);

  private readonly _entries = signal<readonly TextEntry[]>([]);
  private etag: string | null = null;

  readonly entries = this._entries.asReadonly();
  /** The key areas: the part before the first dot, without duplicates. */
  readonly areas = computed<readonly string[]>(() => [
    ...new Set(this._entries().map((entry) => areaOf(entry.key))),
  ]);

  /** Loads the catalogue from the cache, before the first network request. */
  async restore(): Promise<void> {
    const stored = await this.held();
    if (stored === null) return;
    this.etag = stored.etag;
    this.apply(stored.entries);
  }

  /** Loads the catalogue from the server. On an error, the current catalogue stays. */
  async load(): Promise<void> {
    try {
      const answer = await firstValueFrom(this.api.catalogue(this.etag));
      this.etag = answer.etag;
      if (answer.body !== null) await this.adopt(answer.body.entries);
    } catch {
      // The ApiClient reports the error. Without the server, the cached
      // catalogue stays, or else the built-in one.
    }
  }

  async change(key: string, locale: Locale, value: string): Promise<void> {
    await this.replace(await firstValueFrom(this.api.change(key, locale, value)));
  }

  /** Resets a text to its default. */
  async reset(key: string, locale: Locale): Promise<void> {
    await this.replace(await firstValueFrom(this.api.reset(key, locale)));
  }

  private async replace(entry: TextEntry): Promise<void> {
    await this.adopt(this._entries().map((known) => (known.key === entry.key ? entry : known)));
  }

  private async adopt(entries: readonly TextEntry[]): Promise<void> {
    this.apply(entries);
    try {
      await this.cache.write({ etag: this.etag, entries });
    } catch {
      // Without a cache, the next start loads the catalogue from the server.
    }
  }

  private apply(entries: readonly TextEntry[]): void {
    this._entries.set(entries);
    this.i18n.useTexts(textsOf(entries));
  }

  private async held(): Promise<CachedTexts | null> {
    try {
      return await this.cache.read();
    } catch {
      // A blocked cache gives the built-in catalogue.
      return null;
    }
  }
}

/** The area of a key: `karte.legende` is in `karte`. */
export function areaOf(key: string): string {
  return key.split('.')[0];
}
