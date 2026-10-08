import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap, filter, pipe, tap } from 'rxjs';
import { TermsApi } from '../../core/api/terms.api';
import type { Term, TermKind } from '../../core/api/models';
import { trigger } from './write';

interface TermsState {
  /** `null` until the first request starts. */
  terms: readonly Term[] | null;
}

/** The term catalogue. The store gets it once and then only reads it. */
export const TermsStore = signalStore(
  { providedIn: 'root' },
  withState<TermsState>({ terms: null }),
  withProps(() => ({ _api: inject(TermsApi) })),
  withMethods((store) => ({
    load: trigger(
      rxMethod<true>(
        pipe(
          filter(() => store.terms() === null),
          tap(() => {
            patchState(store, { terms: [] });
          }),
          exhaustMap(() =>
            store._api.list().pipe(
              tapResponse({
                next: (terms) => {
                  patchState(store, { terms });
                },
                error: () => undefined,
              }),
            ),
          ),
        ),
      ),
    ),

    /** The terms of one kind, in the order of the catalogue. */
    forKind(kind: TermKind): Term[] {
      return (store.terms() ?? [])
        .filter((term) => term.kind === kind)
        .sort((one, other) => one.position - other.position);
    },
  })),
);

/** The instance type of {@link TermsStore}. */
export type TermsStore = InstanceType<typeof TermsStore>;
