import { of, throwError, type Observable } from 'rxjs';
import { GlossaryApi } from '../core/api/glossary.api';
import type { GlossaryEntry, GlossaryEntryWrite } from '../core/api/models';
import type { ProblemDetail } from '../core/api/problem';

const STAMP = '2026-09-12T10:00:00Z';

export const HYMENIUM: GlossaryEntry = {
  id: 'begriff-eins',
  term: 'Hymenium',
  definition: 'Die sporenbildende Schicht der Fruchtschicht.',
  definitionEn: 'The spore-bearing layer.',
  updatedByName: 'Frederik',
  updatedAt: STAMP,
};

export const LAMELLEN: GlossaryEntry = {
  id: 'begriff-zwei',
  term: 'Lamellen',
  definition: 'Blattartige Strukturen unter dem Hut.',
  definitionEn: '',
  updatedByName: 'Frederik',
  updatedAt: STAMP,
};

export const GLOSSARY: GlossaryEntry[] = [HYMENIUM, LAMELLEN];

/** A double for the glossary API. The test reads the requests. */
export class GlossaryApiDouble {
  entryList: GlossaryEntry[] = GLOSSARY;
  /** When set, the next write fails with this problem. */
  rejectWith: ProblemDetail | null = null;

  readonly created: GlossaryEntryWrite[] = [];
  readonly updated: { id: string; write: GlossaryEntryWrite }[] = [];
  readonly removed: string[] = [];

  list(): Observable<GlossaryEntry[]> {
    return of(this.entryList);
  }

  create(write: GlossaryEntryWrite): Observable<GlossaryEntry> {
    this.created.push(write);
    return this.answer({ ...HYMENIUM, id: 'begriff-neu', ...write });
  }

  update(id: string, write: GlossaryEntryWrite): Observable<GlossaryEntry> {
    this.updated.push({ id, write });
    return this.answer({ ...HYMENIUM, id, ...write });
  }

  remove(id: string): Observable<null> {
    this.removed.push(id);
    return this.answer(null);
  }

  private answer<T>(value: T): Observable<T> {
    const failure = this.rejectWith;
    this.rejectWith = null;
    return failure === null ? of(value) : throwError(() => failure);
  }
}

export function glossaryApiProvider(double: GlossaryApiDouble): {
  provide: typeof GlossaryApi;
  useValue: unknown;
} {
  return { provide: GlossaryApi, useValue: double };
}
