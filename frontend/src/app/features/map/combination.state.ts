import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth';
import { CombinationsApi } from '../../core/api/combinations.api';
import type { Combination, Rule } from '../../core/api/models';
import { encodeFactors, fromWire, readFactors, replaceFactor, toWire, type Factor } from './factors';

/** Der Schlüssel im Speicher des Geräts. */
export const STORAGE_KEY = 'pilzkarte.combination.v1';

interface Saved {
  rule?: unknown;
  factors?: unknown;
}

/** Regel, Faktoren und die gespeicherten Kombinationen des Kontos. */
@Injectable({ providedIn: 'root' })
export class CombinationState {
  private readonly api = inject(CombinationsApi);
  private readonly auth = inject(AuthService);

  readonly rule = signal<Rule>('intersection');
  readonly factors = signal<readonly Factor[]>([]);

  private readonly _saved = signal<readonly Combination[]>([]);
  /** Die gespeicherten Kombinationen des Kontos. Ohne Konto leer. */
  readonly saved = this._saved.asReadonly();

  readonly active = computed(() => this.factors().filter((factor) => factor.active));

  constructor() {
    this.load();
    effect(() => {
      this.store({ rule: this.rule(), factors: encodeFactors(this.factors()) });
    });
    effect(() => {
      if (this.auth.signedIn()) void this.loadSaved();
      else this._saved.set([]);
    });
  }

  apply(factor: Factor): void {
    this.factors.set(replaceFactor(this.factors(), factor));
  }

  remove(factor: Factor): void {
    this.factors.set(this.factors().filter((entry) => entry.source !== factor.source));
  }

  /** Eine neue Quelle beginnt mit der oberen Hälfte ihrer Skala. */
  start(source: string, low: number, high: number): Factor {
    const middle = low + (high - low) / 2;
    const factor: Factor = { source, condition: 'above', low: middle, high: 0, active: true };
    this.apply(factor);
    return factor;
  }

  pick(combination: Combination): void {
    this.rule.set(combination.rule ?? 'intersection');
    this.factors.set((combination.factors ?? []).map(fromWire));
  }

  async save(name: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.create({ name, rule: this.rule(), factors: this.factors().map(toWire) }));
      await this.loadSaved();
      return true;
    } catch {
      return false;
    }
  }

  async delete(combination: Combination): Promise<void> {
    try {
      await firstValueFrom(this.api.remove(combination.id));
      await this.loadSaved();
    } catch {
      // Der ApiClient hat den Fehler schon als Toast gezeigt.
    }
  }

  private async loadSaved(): Promise<void> {
    try {
      const page = await firstValueFrom(this.api.catalogue());
      this._saved.set(page.items);
    } catch {
      this._saved.set([]);
    }
  }

  private store(state: Saved): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ohne Speicher gilt die Kombination nur für diese Sitzung.
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return;
      const state = JSON.parse(raw) as Saved | null;
      if (typeof state !== 'object' || state === null) return;
      if (state.rule === 'intersection' || state.rule === 'graded') this.rule.set(state.rule);
      if (typeof state.factors === 'string') this.factors.set(readFactors(state.factors));
    } catch {
      // Ein unlesbarer Stand wird verworfen.
    }
  }
}
