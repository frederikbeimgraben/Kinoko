import { Injectable, inject } from '@angular/core';
import { tap, type Observable } from 'rxjs';
import { GlossaryApi } from '../api/glossary.api';
import type { GlossaryEntry, GlossaryEntryWrite } from '../api/models';
import { SearchableListState } from './searchable-list.state';

/** The glossary in memory. The account and the administration read the same list. */
@Injectable({ providedIn: 'root' })
export class GlossaryState extends SearchableListState<GlossaryEntry> {
  private readonly api = inject(GlossaryApi);

  readonly entries = this.items;

  load(): void {
    this.api.list().subscribe((entries) => {
      this.setItems(entries);
    });
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
        this.drop(id);
      }),
    );
  }

  protected matches(item: GlossaryEntry, needle: string): boolean {
    return `${item.term} ${item.definition}`.toLocaleLowerCase().includes(needle);
  }

  protected sortKey(item: GlossaryEntry): string {
    return item.term;
  }
}
