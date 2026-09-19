import { Injectable, computed, inject, signal } from '@angular/core';
import { SpeciesApi } from '../../core/api/species.api';
import type { BodyPart, SpeciesCounts, SpeciesEntry, SpeciesWrite } from '../../core/api/models';
import { toWrite } from './species-write';

/** Profil und Zahlen einer Art im Bearbeiten-Modus. */
@Injectable({ providedIn: 'root' })
export class SpeciesEditorState {
  private readonly api = inject(SpeciesApi);

  private readonly _slug = signal('');
  private readonly _species = signal<SpeciesEntry | null>(null);
  private readonly _counts = signal<SpeciesCounts | null>(null);
  private readonly _extraParts = signal<readonly BodyPart[]>([]);

  readonly species = this._species.asReadonly();
  readonly counts = this._counts.asReadonly();

  /** Teile, die jemand gewählt hat und die noch keinen Wert tragen. */
  readonly extraParts = this._extraParts.asReadonly();
  readonly forecast = computed(() => this._species()?.forecastEnabled ?? false);

  /** Lädt Profil und Zahlen einer Art. Ein zweiter Aufruf zur selben Art ruht. */
  load(slug: string): void {
    if (this._slug() === slug) return;
    this._slug.set(slug);
    this._species.set(null);
    this._counts.set(null);
    this._extraParts.set([]);
    this.api.profile(slug).subscribe((entry) => {
      if (this._slug() === slug) this._species.set(entry);
    });
    this.api.counts(slug).subscribe((counts) => {
      if (this._slug() === slug) this._counts.set(counts);
    });
  }

  /** Merkt Teile ohne Wert, damit der Editor eine Zeile dafür zeigt. */
  addParts(parts: readonly BodyPart[]): void {
    this._extraParts.update((held) => [...held, ...parts.filter((one) => !held.includes(one))]);
  }

  /** Schreibt die geänderten Felder. Die Antwort trägt den neuen Stand. */
  save(change: Partial<SpeciesWrite>): void {
    const species = this._species();
    const slug = this._slug();
    if (species === null || slug === '') return;
    this.api.replace(slug, { ...toWrite(species), ...change }).subscribe((entry) => {
      this._species.set(entry);
    });
  }

  /** Schaltet die Vorhersage. Die Antwort trägt den neuen Stand. */
  setForecast(enabled: boolean): void {
    const slug = this._slug();
    if (slug === '') return;
    this.api.setForecast(slug, enabled).subscribe((entry) => {
      this._species.set(entry);
    });
  }

  remove(): void {
    const slug = this._slug();
    if (slug !== '') this.api.remove(slug).subscribe();
  }
}
