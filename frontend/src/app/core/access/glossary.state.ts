import { Injectable, computed, inject, signal } from '@angular/core';
import { tap, type Observable } from 'rxjs';
import { GlossaryApi } from '../api/glossary.api';
import type { GlossaryEntry, GlossaryEntryWrite } from '../api/models';

/** Das Glossar im Speicher. Konto und Verwaltung lesen dieselbe Liste. */
@Injectable({ providedIn: 'root' })
export class GlossaryState {
  private readonly api = inject(GlossaryApi);

  private readonly _entries = signal<readonly GlossaryEntry[] | null>(null);
  private readonly _search = signal('');

  /** `null`, solange die erste Antwort aussteht. */
  readonly entries = this._entries.asReadonly();
  readonly search = this._search.asReadonly();

  readonly found = computed(() => {
    const needle = this._search().trim().toLocaleLowerCase();
    const all = this._entries() ?? [];
    if (needle === '') return all;
    return all.filter((one) => `${one.term} ${one.definition}`.toLocaleLowerCase().includes(needle));
  });

  load(): void {
    this.api.list().subscribe((entries) => {
      this._entries.set(entries);
    });
  }

  setSearch(value: string): void {
    this._search.set(value);
  }

  one(id: string): GlossaryEntry | null {
    return this._entries()?.find((entry) => entry.id === id) ?? null;
  }

  create(write: GlossaryEntryWrite): Observable<GlossaryEntry> {
    return this.api.create(write).pipe(
      tap((entry) => {
        this.put(entry);
      }),
    );
  }

  update(id: string, write: GlossaryEntryWrite): Observable<GlossaryEntry> {
    return this.api.update(id, write).pipe(
      tap((entry) => {
        this.put(entry);
      }),
    );
  }

  remove(id: string): Observable<null> {
    return this.api.remove(id).pipe(
      tap(() => {
        this._entries.update((all) => all?.filter((one) => one.id !== id) ?? null);
      }),
    );
  }

  /** Nimmt einen Begriff auf, oder ersetzt ihn. Die Liste bleibt nach Begriff sortiert. */
  private put(entry: GlossaryEntry): void {
    this._entries.update((all) => {
      const rest = (all ?? []).filter((one) => one.id !== entry.id);
      return [...rest, entry].sort((a, b) => a.term.localeCompare(b.term));
    });
  }
}
