import { of, type Observable } from 'rxjs';
import { TermsApi } from '../core/api/terms.api';
import type { Term, TermCreate, TermKind, TermUpdate } from '../core/api/models';

export function term(part: Partial<Term> & Pick<Term, 'id' | 'slug' | 'name'>): Term {
  return { kind: 'smell', group: null, position: 0, ...part };
}

export const ANISE = term({ id: 'begriff-anis', slug: 'anise', name: 'Anis' });
export const FLOUR = term({ id: 'begriff-mehl', slug: 'flour', name: 'Mehl', position: 1 });
export const OAK = term({ id: 'begriff-eiche', slug: 'oak', name: 'Eiche', kind: 'tree' });

export const TERMS: Term[] = [ANISE, FLOUR, OAK];

/** Ein Doppelgänger der Begriffs-API. Der Test liest nach, was gefragt wurde. */
export class TermsApiDouble {
  termList: Term[] = TERMS;

  readonly created: TermCreate[] = [];
  readonly patched: { id: string; write: TermUpdate }[] = [];
  readonly removed: string[] = [];
  readonly merged: { id: string; into: string }[] = [];

  list(kind?: TermKind): Observable<Term[]> {
    const all = this.termList;
    return of(kind === undefined ? all : all.filter((one) => one.kind === kind));
  }

  create(write: TermCreate): Observable<Term> {
    this.created.push(write);
    return of(term({ id: 'begriff-neu', ...write }));
  }

  patch(id: string, write: TermUpdate): Observable<Term> {
    this.patched.push({ id, write });
    const found = this.termList.find((one) => one.id === id) ?? ANISE;
    return of({ ...found, ...write });
  }

  remove(id: string): Observable<null> {
    this.removed.push(id);
    return of(null);
  }

  merge(id: string, into: string): Observable<null> {
    this.merged.push({ id, into });
    return of(null);
  }
}

/** Hängt den Doppelgänger an die Stelle der echten API. */
export function termsApiProvider(double: TermsApiDouble): {
  provide: typeof TermsApi;
  useValue: unknown;
} {
  return { provide: TermsApi, useValue: double };
}
