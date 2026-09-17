import { Injectable, inject, signal } from '@angular/core';
import { TermsApi } from '../../core/api/terms.api';
import type { Term, TermKind } from '../../core/api/models';

/** Der Katalog der Begriffe. Er wird einmal geholt und danach nur gelesen. */
@Injectable({ providedIn: 'root' })
export class TermsState {
  private readonly api = inject(TermsApi);
  private readonly _terms = signal<Term[] | null>(null);

  readonly terms = this._terms.asReadonly();

  load(): void {
    if (this._terms() !== null) return;
    this._terms.set([]);
    this.api.list().subscribe((terms) => {
      this._terms.set(terms);
    });
  }

  /** Die Begriffe einer Gattung, in der Reihenfolge des Katalogs. */
  forKind(kind: TermKind): Term[] {
    return (this._terms() ?? [])
      .filter((term) => term.kind === kind)
      .sort((one, other) => one.position - other.position);
  }
}
