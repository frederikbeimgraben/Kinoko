import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import type { components } from '../../core/api/contract';
import { OfflineStore } from '../../core/offline/offline-store';
import { SpeciesApi } from '../../core/api/species.api';
import { SpeciesImagesApi } from '../../core/api/species-images.api';
import type { ProblemDetail } from '../../core/api/problem';
import type { Species, SpeciesBrief, SpeciesCatalogue, SpeciesImage } from '../../core/api/models';

/** Der ganze Katalog in einem Zug, so wie ihn der Vertrag nennt. */
export type SpeciesBundle = components['schemas']['SpeciesBundle'];

const BUNDLE_PATH = '/species/bundle';
const BUNDLE_KEY = 'bundle';
const ETAG_KEY = 'etag';

/**
 * Der Katalog im Speicher. Die Liste hängt an keiner Seite: sie wird einmal
 * geladen und überlebt den Wechsel zwischen Liste und Artseite. Profile kommen
 * je Slug dazu und bleiben ebenso liegen.
 */
@Injectable({ providedIn: 'root' })
export class SpeciesState {
  private readonly api = inject(SpeciesApi);
  private readonly client = inject(ApiClient);
  private readonly offline = inject(OfflineStore);
  private readonly imagesApi = inject(SpeciesImagesApi);
  private readonly running = new Set<string>();

  private readonly _bundle = signal<SpeciesBundle | null>(null);
  private readonly _catalogue = signal<SpeciesCatalogue | null>(null);
  private readonly _profile = signal<ReadonlyMap<string, Species>>(new Map());
  private readonly _unknown = signal<ReadonlySet<string>>(new Set());
  private readonly _images = signal<ReadonlyMap<string, readonly SpeciesImage[]>>(new Map());
  private readonly _activeSpecies = signal<string | null>(null);
  private readonly _origin = signal<{ slug: string; name: string } | null>(null);

  /**
   * Der ganze Katalog, ein Topf.
   *
   * Bis D9 waren es drei: die sammelbaren, die übrigen und beide zusammen. Der
   * Grund war eine Vorgabe im Vertrag, die es nicht mehr gibt.
   */
  /** Der Katalog vom Gerät. Suche und Filter laufen gegen diesen Bestand. */
  readonly bundle = this._bundle.asReadonly();
  readonly catalogue = this._catalogue.asReadonly();
  readonly profile = this._profile.asReadonly();
  /** Slugs, die das Backend mit 404 beantwortet hat. */
  readonly unknown = this._unknown.asReadonly();
  /** Die freigegebenen Bilder je Art. Ein leerer Eintrag heißt: geladen, keine Bilder. */
  readonly images = this._images.asReadonly();
  /**
   * Die Art, die die Karte zeigt. Bis A2 den Kartenzustand liefert, ist dieses
   * Signal die einzige Quelle; danach spiegelt es ihn.
   */
  readonly activeSpecies = this._activeSpecies.asReadonly();
  readonly origin = this._origin.asReadonly();

  private readonly _filtered = signal<SpeciesCatalogue | null>(null);
  /**
   * Die Liste unter dem Filter. Sie kommt vom Server, weil dort die Regel
   * steht, die auch die Zahlen rechnet: innerhalb einer Gruppe oder, zwischen
   * den Gruppen und, und die Unbeurteilbaren als eigene Menge.
   */
  readonly filtered = this._filtered.asReadonly();

  loadFiltered(query: { wert: readonly string[]; ohneAngabe: readonly string[] }): void {
    const key = `gefiltert:${query.wert.join(',')}|${query.ohneAngabe.join(',')}`;
    if (!this.begin(key)) return;
    this.api.catalogue(query).subscribe({
      next: (catalogue) => {
        this._filtered.set(catalogue);
        this.running.delete(key);
      },
      error: () => this.running.delete(key),
    });
  }

  /** Zeigt den Katalog vom Gerät und gleicht ihn danach mit ETag ab. */
  async loadBundle(): Promise<void> {
    const known = await this.offline.get<SpeciesBundle>('catalog', BUNDLE_KEY);
    if (known !== null) this._bundle.set(known);
    const etag = await this.offline.get<string>('catalog', ETAG_KEY);
    const fresh = await firstValueFrom(
      this.client.getTagged<SpeciesBundle>(BUNDLE_PATH, known === null ? null : etag),
    ).catch(() => null);
    if (fresh === null) return;
    this._bundle.set(fresh.body);
    await this.offline.put('catalog', BUNDLE_KEY, fresh.body);
    await this.offline.put('catalog', ETAG_KEY, fresh.etag);
  }

  loadCatalogue(): void {
    if (this._catalogue() !== null || !this.begin('liste')) return;
    this.api.catalogue().subscribe({
      next: (catalogue) => {
        this._catalogue.set(catalogue);
        this.running.delete('liste');
      },
      error: () => this.running.delete('liste'),
    });
  }

  loadProfile(slug: string): void {
    if (this._profile().has(slug) || this._unknown().has(slug) || !this.begin(slug)) return;
    this.api.profile(slug).subscribe({
      next: (art) => {
        this._profile.update((alt) => new Map(alt).set(slug, art));
        this.running.delete(slug);
      },
      error: (failure: ProblemDetail) => {
        // Ein 404 ist kein Ausfall, sondern eine Antwort: die Art gibt es nicht.
        if (failure.status === 404) this._unknown.update((alt) => new Set(alt).add(slug));
        this.running.delete(slug);
      },
    });
  }

  /**
   * Die Bilder einer Art. Sie kommen getrennt vom Profil: das Profil liegt als
   * TOML beim Dienst, die Bilder stehen in der Datenbank.
   */
  loadImages(slug: string): void {
    const schluessel = `bilder:${slug}`;
    if (this._images().has(slug) || !this.begin(schluessel)) return;
    this.imagesApi.ofSpecies(slug).subscribe({
      next: (images) => {
        this._images.update((alt) => new Map(alt).set(slug, images));
        this.running.delete(schluessel);
      },
      error: () => this.running.delete(schluessel),
    });
  }

  /** Eine Art aus dem geladenen Katalog, sonst nichts. */
  briefOf(slug: string): SpeciesBrief | null {
    return this.catalogue()?.arten.find((art) => art.slug === slug) ?? null;
  }

  /**
   * Der Name einer Art, sobald ein Katalog geladen ist. Ohne ihn bleibt nur
   * der Slug, und der steht in keiner Oberfläche.
   */
  nameOf(slug: string): string | null {
    return this.briefOf(slug)?.name ?? null;
  }

  /**
   * Woher der Sprung auf ein Verwechslungsprofil kam. Diese Profile stehen im
   * Katalog, weil eine sammelbare Art ihnen ähnlich sieht; von dort führt der
   * Rückweg zurück zu genau dieser Art.
   */
  setOrigin(art: { slug: string; name: string } | null): void {
    this._origin.set(art);
  }

  select(slug: string | null): void {
    this._activeSpecies.set(slug);
  }

  /** Verhindert, dass zwei Aufrufe dieselbe Anfrage doppelt stellen. */
  private begin(schluessel: string): boolean {
    if (this.running.has(schluessel)) return false;
    this.running.add(schluessel);
    return true;
  }
}
