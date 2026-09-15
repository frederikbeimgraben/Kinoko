import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SpeciesApi } from '../../core/api/species.api';
import type { SpeciesBundle, SpeciesEntry, StandardColour } from '../../core/api/models';
import { OfflineStore } from '../../core/offline/offline-store';
import { factsOf, type Counts, type Facts } from './facets';

/** Eine Art mit ihren gerechneten Filterachsen. */
export interface CatalogueEntry {
  readonly species: SpeciesEntry;
  readonly facts: Facts;
}

const BUNDLE_KEY = 'bundle';
const ETAG_KEY = 'etag';

/** Ob ein Bündel alle Felder der Baseline führt. Der ETag zählt nur die Arten. */
function complete(bundle: unknown): bundle is SpeciesBundle {
  if (typeof bundle !== 'object' || bundle === null) return false;
  const shape = bundle as Record<string, unknown>;
  return (
    Array.isArray(shape['items']) &&
    Array.isArray(shape['standardColours']) &&
    typeof shape['facets'] === 'object' &&
    shape['facets'] !== null
  );
}

/** Der Artenkatalog vom Gerät. Suche, Filter und Einordnung lesen ihn. */
@Injectable({ providedIn: 'root' })
export class SpeciesState {
  private readonly api = inject(SpeciesApi);
  private readonly offline = inject(OfflineStore);

  private readonly _bundle = signal<SpeciesBundle | null>(null);
  private readonly _failed = signal(false);
  private readonly _activeSpecies = signal<string | null>(null);
  private running = false;

  readonly bundle = this._bundle.asReadonly();
  readonly failed = this._failed.asReadonly();
  readonly activeSpecies = this._activeSpecies.asReadonly();

  /** Alle Arten. Leer heißt: noch nichts geladen. */
  readonly species = computed<readonly SpeciesEntry[]>(() => this._bundle()?.items ?? []);

  /** Ob der Katalog noch fehlt und auch kein Fehler vorliegt. */
  readonly loading = computed(() => this._bundle() === null && !this._failed());

  /** Die zwölf Standardfarben des Filters, aus dem Bündel. */
  readonly palette = computed<readonly StandardColour[]>(() => this._bundle()?.standardColours ?? []);

  /** Die gezählten Achsen des Katalogs, aus dem Bündel. */
  readonly facets = computed<Counts>(() => this._bundle()?.facets ?? {});

  /** Jede Art mit ihren Achsen. Suche und Filter lesen diese Liste. */
  readonly entries = computed<readonly CatalogueEntry[]>(() => {
    const palette = this.palette();
    return this.species().map((species) => ({ species, facts: factsOf(species, palette) }));
  });

  readonly facts = computed<readonly Facts[]>(() => this.entries().map((one) => one.facts));

  private readonly bySlug = computed(() => new Map(this.species().map((entry) => [entry.slug, entry])));

  private readonly byId = computed(() => new Map(this.species().map((entry) => [entry.id, entry])));

  /** Zeigt den Katalog vom Gerät und gleicht ihn danach mit ETag ab. */
  async loadBundle(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.fromStore();
      await this.fromServer();
    } finally {
      this.running = false;
    }
  }

  /** Holt den Katalog erneut, nachdem ein Ladefehler gezeigt wurde. */
  reload(): void {
    this._failed.set(false);
    void this.loadBundle();
  }

  entryOf(slug: string): SpeciesEntry | null {
    return this.bySlug().get(slug) ?? null;
  }

  entryById(id: string): SpeciesEntry | null {
    return this.byId().get(id) ?? null;
  }

  nameOf(slug: string): string | null {
    return this.entryOf(slug)?.name ?? null;
  }

  select(slug: string | null): void {
    this._activeSpecies.set(slug);
  }

  private async fromStore(): Promise<void> {
    const known = await this.offline.get<unknown>('catalog', BUNDLE_KEY);
    if (complete(known)) this._bundle.set(known);
  }

  private async fromServer(): Promise<void> {
    const etag = this._bundle() === null ? null : await this.offline.get<string>('catalog', ETAG_KEY);
    const answer = await firstValueFrom(this.api.bundle(etag)).catch(() => null);
    if (answer === null) {
      this._failed.set(this._bundle() === null);
      return;
    }
    await this.offline.put('catalog', ETAG_KEY, answer.etag);
    if (answer.body !== null) {
      this._bundle.set(answer.body);
      await this.offline.put('catalog', BUNDLE_KEY, answer.body);
    }
  }
}
