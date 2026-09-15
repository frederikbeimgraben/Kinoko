import { Injectable, inject, signal } from '@angular/core';
import { TaxaApi } from '../../core/api/taxa.api';
import type { TaxonPage, TaxonRank } from '../../core/api/models';

/** Die geladenen Stufen der Einordnung, je Rang und Slug. */
@Injectable({ providedIn: 'root' })
export class TaxonomyState {
  private readonly api = inject(TaxaApi);
  private readonly running = new Set<string>();

  private readonly _pages = signal<ReadonlyMap<string, TaxonPage>>(new Map());
  private readonly _unknown = signal<ReadonlySet<string>>(new Set());

  load(rank: TaxonRank, slug: string): void {
    const key = keyOf(rank, slug);
    if (this._pages().has(key) || this._unknown().has(key) || this.running.has(key)) return;
    this.running.add(key);
    this.api.page(rank, slug).subscribe({
      next: (page) => {
        this._pages.update((held) => new Map(held).set(key, page));
        this.running.delete(key);
      },
      error: () => {
        this._unknown.update((held) => new Set(held).add(key));
        this.running.delete(key);
      },
    });
  }

  pageOf(rank: TaxonRank, slug: string): TaxonPage | null {
    return this._pages().get(keyOf(rank, slug)) ?? null;
  }

  isUnknown(rank: TaxonRank, slug: string): boolean {
    return this._unknown().has(keyOf(rank, slug));
  }
}

function keyOf(rank: TaxonRank, slug: string): string {
  return `${rank}/${slug}`;
}
