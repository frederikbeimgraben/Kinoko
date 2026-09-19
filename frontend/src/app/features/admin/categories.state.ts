import { Injectable, computed, inject, signal } from '@angular/core';
import { tap, type Observable } from 'rxjs';
import { SearchableListState } from '../../core/access/searchable-list.state';
import { TermsApi } from '../../core/api/terms.api';
import type { Term, TermKind } from '../../core/api/models';
import { slugOf } from './term-slug';

/** Die Begriffe der Verwaltung: anlegen, umbenennen, löschen, verschmelzen. */
@Injectable({ providedIn: 'root' })
export class CategoriesState extends SearchableListState<Term> {
  private readonly api = inject(TermsApi);
  private readonly _kind = signal<TermKind>('smell');

  readonly kind = this._kind.asReadonly();

  /** Die Begriffe der gewählten Gattung, so wie die Suche sie lässt. */
  readonly visible = computed(() => this.found().filter((one) => one.kind === this._kind()));

  load(): void {
    this.api.list().subscribe((terms) => {
      this.setItems(terms);
    });
  }

  setKind(kind: TermKind): void {
    this._kind.set(kind);
  }

  create(name: string): Observable<Term> {
    return this.api.create({ kind: this._kind(), slug: slugOf(name), name }).pipe(
      tap((created) => {
        this.put(created);
      }),
    );
  }

  rename(id: string, name: string): Observable<Term> {
    return this.api.patch(id, { name }).pipe(
      tap((changed) => {
        this.put(changed);
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

  merge(id: string, into: string): Observable<null> {
    return this.api.merge(id, into).pipe(
      tap(() => {
        this.drop(id);
      }),
    );
  }

  protected matches(item: Term, needle: string): boolean {
    return item.name.toLocaleLowerCase().includes(needle);
  }

  protected sortKey(item: Term): string {
    return item.name;
  }
}
