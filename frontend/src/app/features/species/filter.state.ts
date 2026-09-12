import { Injectable, computed, effect, signal } from '@angular/core';
import { FACET_KEYS, type FacetKey } from '../../core/api/models';

const STORAGE_KEY = 'pilzkarte.artenfilter';

interface Saved {
  werte?: Record<string, string[]>;
  ohneAngabe?: string[];
}

function isKey(value: string): value is FacetKey {
  return (FACET_KEYS as readonly string[]).includes(value);
}

/**
 * Die gewählten Werte je Gruppe. Innerhalb einer Gruppe gilt oder, zwischen
 * den Gruppen und — dieselbe Verknüpfung, die der Vertrag rechnet.
 *
 * Der Zustand lebt in der App und wird lokal gesichert, nicht in der Adresse.
 * Dieselbe Regel wie beim Kartenzustand: er soll Neuladen und Offline-Betrieb
 * überstehen, und eine Adresse mit achtzehn Parametern liest niemand.
 */
@Injectable({ providedIn: 'root' })
export class SpeciesFilterState {
  private readonly _values = signal<ReadonlyMap<FacetKey, ReadonlySet<string>>>(new Map());
  private readonly _keepUnknown = signal<ReadonlySet<FacetKey>>(new Set());

  readonly values = this._values.asReadonly();
  readonly keepUnknown = this._keepUnknown.asReadonly();

  /** Wie viele Gruppen etwas einschränken. Null heißt: die ganze Liste. */
  readonly activeGroups = computed<number>(
    () => [...this._values().values()].filter((chosen) => chosen.size > 0).length,
  );

  readonly any = computed<boolean>(() => this.activeGroups() > 0);

  /** Die Parameter für `GET /api/arten`, so wie der Vertrag sie nimmt. */
  readonly query = computed<{ wert: string[]; ohneAngabe: string[] }>(() => ({
    wert: [...this._values()]
      .flatMap(([key, chosen]) => [...chosen].map((value) => `${key}:${value}`))
      .sort((one, other) => one.localeCompare(other)),
    ohneAngabe: [...this._keepUnknown()].sort((one, other) => one.localeCompare(other)),
  }));

  constructor() {
    this.load();
    effect(() => {
      this.save(this._values(), this._keepUnknown());
    });
  }

  chosenIn(key: FacetKey): ReadonlySet<string> {
    return this._values().get(key) ?? new Set();
  }

  countIn(key: FacetKey): number {
    return this.chosenIn(key).size;
  }

  keeps(key: FacetKey): boolean {
    return this._keepUnknown().has(key);
  }

  toggle(key: FacetKey, value: string): void {
    this._values.update((old) => {
      const next = new Map(old);
      const chosen = new Set(next.get(key) ?? []);
      if (chosen.has(value)) chosen.delete(value);
      else chosen.add(value);
      if (chosen.size) next.set(key, chosen);
      else next.delete(key);
      return next;
    });
  }

  /** Nimmt eine ganze Gruppe aus dem Filter. Die Marke über der Liste tut das. */
  clear(key: FacetKey): void {
    this._values.update((old) => {
      const next = new Map(old);
      next.delete(key);
      return next;
    });
    this._keepUnknown.update((old) => {
      const next = new Set(old);
      next.delete(key);
      return next;
    });
  }

  clearAll(): void {
    this._values.set(new Map());
    this._keepUnknown.set(new Set());
  }

  toggleKeepUnknown(key: FacetKey): void {
    this._keepUnknown.update((old) => {
      const next = new Set(old);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  private save(values: ReadonlyMap<FacetKey, ReadonlySet<string>>, keepUnknown: ReadonlySet<FacetKey>): void {
    const stand: Saved = {
      werte: Object.fromEntries([...values].map(([key, chosen]) => [key, [...chosen]])),
      ohneAngabe: [...keepUnknown],
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stand));
    } catch {
      // Ein gesperrter oder voller Speicher ist kein Fehler; dann gilt der
      // Filter eben nur für diese Sitzung.
    }
  }

  /** Ein Wert in falscher Form wird verworfen, nicht übernommen. */
  private load(): void {
    let stand: Saved;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return;
      const got: Saved | null = JSON.parse(raw) as Saved | null;
      if (typeof got !== 'object' || got === null) return;
      stand = got;
    } catch {
      return;
    }
    const values = new Map<FacetKey, ReadonlySet<string>>();
    for (const [key, chosen] of Object.entries(stand.werte ?? {})) {
      if (isKey(key) && Array.isArray(chosen) && chosen.length) {
        values.set(key, new Set(chosen.filter((value) => typeof value === 'string')));
      }
    }
    this._values.set(values);
    this._keepUnknown.set(new Set((stand.ohneAngabe ?? []).filter(isKey)));
  }
}
