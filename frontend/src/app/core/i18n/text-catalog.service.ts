import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TextsApi } from '../api/texts.api';
import type { TextEntry } from '../api/models';
import { I18nService, type LoadedTexts } from './i18n.service';
import { TEXT_CACHE, type CachedTexts } from './text-cache';
import type { Locale } from './translations';

/** Aus den Einträgen wird je Sprache ein Wörterbuch für den `I18nService`. */
export function textsOf(entries: readonly TextEntry[]): LoadedTexts {
  const texts: Partial<Record<Locale, Record<string, string>>> = {};
  for (const entry of entries) {
    for (const [locale, value] of Object.entries(entry.values) as [Locale, string][]) {
      (texts[locale] ??= {})[entry.key] = value;
    }
  }
  return texts;
}

/**
 * Die Texte aus der Datenbank: erst aus dem `TextCache`, dann vom Server.
 */
@Injectable({ providedIn: 'root' })
export class TextCatalogService {
  private readonly api = inject(TextsApi);
  private readonly i18n = inject(I18nService);
  private readonly cache = inject(TEXT_CACHE);

  private readonly _entries = signal<readonly TextEntry[]>([]);
  private etag: string | null = null;

  readonly entries = this._entries.asReadonly();
  /** Die Bereiche der Schlüssel: alles vor dem ersten Punkt, ohne Doppel. */
  readonly areas = computed<readonly string[]>(() => [
    ...new Set(this._entries().map((entry) => areaOf(entry.key))),
  ]);

  /** Der Katalog aus dem Zwischenspeicher, noch vor dem ersten Netzweg. */
  async restore(): Promise<void> {
    const stored = await this.held();
    if (stored === null) return;
    this.etag = stored.etag;
    this.apply(stored.entries);
  }

  /** Holt den Katalog vom Server. Ein Fehler lässt den bisherigen stehen. */
  async load(): Promise<void> {
    try {
      const answer = await firstValueFrom(this.api.catalogue(this.etag));
      this.etag = answer.etag;
      if (answer.body !== null) await this.adopt(answer.body.entries);
    } catch {
      // Der ApiClient hat den Fehler schon gemeldet. Ohne Server bleibt es
      // beim abgelegten Katalog, sonst beim eingebauten.
    }
  }

  /** Setzt einen Text in einer Sprache. */
  async change(key: string, locale: Locale, value: string): Promise<void> {
    await this.replace(await firstValueFrom(this.api.change(key, locale, value)));
  }

  /** Holt die Vorgabe eines Textes zurück. */
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
      // Ohne Ablage holt der nächste Start den Katalog wieder vom Server.
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
      // Ein gesperrter Ablageort führt zum eingebauten Katalog.
      return null;
    }
  }
}

/** Der Bereich eines Schlüssels: `karte.legende` gehört zu `karte`. */
export function areaOf(key: string): string {
  return key.split('.')[0];
}
