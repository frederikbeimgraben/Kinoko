import { Injectable, computed, inject, signal } from '@angular/core';
import { SpeciesApi } from '../../core/api/species.api';
import type { SpeciesCounts, SpeciesEntry } from '../../core/api/models';

/** Profil und Zahlen einer Art im Bearbeiten-Modus. */
@Injectable({ providedIn: 'root' })
export class SpeciesEditorState {
  private readonly api = inject(SpeciesApi);

  private readonly _slug = signal('');
  private readonly _species = signal<SpeciesEntry | null>(null);
  private readonly _counts = signal<SpeciesCounts | null>(null);

  readonly species = this._species.asReadonly();
  readonly counts = this._counts.asReadonly();
  readonly forecast = computed(() => this._species()?.forecastEnabled ?? false);

  /** Lädt Profil und Zahlen einer Art. Ein zweiter Aufruf zur selben Art ruht. */
  load(slug: string): void {
    if (this._slug() === slug) return;
    this._slug.set(slug);
    this._species.set(null);
    this._counts.set(null);
    this.api.profile(slug).subscribe((entry) => {
      if (this._slug() === slug) this._species.set(entry);
    });
    this.api.counts(slug).subscribe((counts) => {
      if (this._slug() === slug) this._counts.set(counts);
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
