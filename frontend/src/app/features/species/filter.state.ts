import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { OverlayStackService } from '../../core/navigation/overlay-stack.service';
import { EMPTY_SELECTION, GROUP_KEYS, type GroupKey, type Selection } from './facets';

const STORAGE_KEY = 'pilzkarte.speciesfilter';

interface Saved {
  values?: Record<string, string[]>;
  colours?: Record<string, string>;
  keepUnknown?: string[];
}

function isGroup(value: string): value is GroupKey {
  return (GROUP_KEYS as readonly string[]).includes(value);
}

/** Die Wahl im Filterblatt. In einer Gruppe oder, zwischen Gruppen und. */
@Injectable({ providedIn: 'root' })
export class SpeciesFilterState {
  private readonly stack = inject(OverlayStackService);
  private readonly _selection = signal<Selection>(EMPTY_SELECTION);
  private readonly _open = signal(false);
  private readonly _group = signal<GroupKey | null>(null);

  readonly selection = this._selection.asReadonly();
  /** Ob das Blatt über der Liste steht. */
  readonly open = this._open.asReadonly();
  /** Die Gruppe, die das Blatt gerade zeigt. Leer heißt: die Übersicht. */
  readonly group = this._group.asReadonly();

  readonly chosenCount = computed(() => {
    const held = this._selection();
    const values = [...held.values.values()].reduce((sum, set) => sum + set.size, 0);
    return values + held.colours.size;
  });

  constructor() {
    this.load();
    effect(() => {
      this.save(this._selection());
    });
  }

  chosenIn(key: GroupKey): ReadonlySet<string> {
    return this._selection().values.get(key) ?? new Set();
  }

  colourOf(part: string): string | null {
    return this._selection().colours.get(part) ?? null;
  }

  keeps(key: GroupKey): boolean {
    return this._selection().keepUnknown.has(key);
  }

  toggle(key: GroupKey, value: string): void {
    this.patch((held) => {
      const values = new Map(held.values);
      const chosen = new Set(values.get(key) ?? []);
      if (chosen.has(value)) chosen.delete(value);
      else chosen.add(value);
      if (chosen.size) values.set(key, chosen);
      else values.delete(key);
      return { ...held, values };
    });
  }

  setColour(part: string, hex: string | null): void {
    this.patch((held) => {
      const colours = new Map(held.colours);
      if (hex === null || colours.get(part) === hex) colours.delete(part);
      else colours.set(part, hex);
      return { ...held, colours };
    });
  }

  toggleKeepUnknown(key: GroupKey): void {
    this.patch((held) => {
      const keepUnknown = new Set(held.keepUnknown);
      if (keepUnknown.has(key)) keepUnknown.delete(key);
      else keepUnknown.add(key);
      return { ...held, keepUnknown };
    });
  }

  /** Nimmt einen einzelnen Wert aus dem Filter. Die Marke über der Liste tut das. */
  dropValue(key: GroupKey, value: string): void {
    this.toggle(key, value);
  }

  dropColour(part: string): void {
    this.setColour(part, null);
  }

  clearAll(): void {
    this._selection.set(EMPTY_SELECTION);
  }

  /** Öffnet das Blatt und legt einen Weg zurück über die Adresszeile an. */
  openSheet(): void {
    if (this._open()) return;
    this._group.set(null);
    this._open.set(true);
    this.stack.open(() => {
      this._open.set(false);
      this._group.set(null);
    });
  }

  /** Schließt das Blatt ganz, auch aus einer offenen Gruppe heraus. */
  closeSheet(): void {
    if (!this._open()) return;
    this._open.set(false);
    this._group.set(null);
    this.stack.closeAll();
  }

  /** Wechselt in eine Gruppe oder, ohne Wert, zur Übersicht zurück. */
  showGroup(key: GroupKey | null): void {
    if (key === this._group()) return;
    if (key === null) {
      this._group.set(null);
      this.stack.back();
    } else {
      this._group.set(key);
      this.stack.open(() => {
        this._group.set(null);
      });
    }
  }

  private patch(change: (held: Selection) => Selection): void {
    this._selection.update(change);
  }

  private save(held: Selection): void {
    const saved: Saved = {
      values: Object.fromEntries([...held.values].map(([key, set]) => [key, [...set]])),
      colours: Object.fromEntries(held.colours),
      keepUnknown: [...held.keepUnknown],
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // Ein gesperrter Speicher ist kein Fehler; der Filter gilt dann je Sitzung.
    }
  }

  /** Ein Wert in falscher Form wird verworfen, nicht übernommen. */
  private load(): void {
    let saved: Saved;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return;
      const got = JSON.parse(raw) as Saved | null;
      if (typeof got !== 'object' || got === null) return;
      saved = got;
    } catch {
      return;
    }
    const values = new Map<GroupKey, ReadonlySet<string>>();
    for (const [key, chosen] of Object.entries(saved.values ?? {})) {
      if (isGroup(key) && Array.isArray(chosen) && chosen.length) values.set(key, new Set(chosen));
    }
    this._selection.set({
      values,
      colours: new Map(Object.entries(saved.colours ?? {})),
      keepUnknown: new Set((saved.keepUnknown ?? []).filter(isGroup)),
    });
  }
}
