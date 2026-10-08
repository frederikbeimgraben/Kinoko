import { inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  Subject,
  asapScheduler,
  buffer,
  catchError,
  debounceTime,
  distinct,
  filter,
  from,
  map,
  mergeMap,
  of,
  pipe,
  share,
  tap,
} from 'rxjs';
import { AccessApi } from '../api/access.api';
import type { PersonName } from '../api/models';

/** The contract allows this number of identifiers in each request. */
const MAX_IDS = 50;

interface PersonNamesState {
  /** The known names. `null` is an identifier without a name the person can see. */
  names: ReadonlyMap<string, string | null>;
}

interface Answer {
  requested: readonly string[];
  found: readonly PersonName[];
}

/** Cuts a list into parts of `size` items. */
export function chunks<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

/** Adds the answer to the known names. A requested identifier without an answer gets `null`. */
export function withAnswer(
  names: ReadonlyMap<string, string | null>,
  { requested, found }: Answer,
): ReadonlyMap<string, string | null> {
  const byId = new Map(found.map((person) => [person.id, person.name] as const));
  return new Map([...names, ...requested.map((id) => [id, byId.get(id) ?? null] as const)]);
}

/** The names of people in a shared group. One task collects its identifiers into one request. */
export const PersonNamesStore = signalStore(
  { providedIn: 'root' },
  withState<PersonNamesState>({ names: new Map() }),
  withProps(() => ({ _api: inject(AccessApi), _asked: new Subject<string>() })),
  withMethods((store) => ({
    /** The name for an identifier. `null` without a name or while the answer waits. */
    nameOf(id: string | null): string | null {
      if (id === null) return null;
      const held = store.names().get(id);
      if (held !== undefined) return held;
      // A template calls this method, so the request starts later and not here.
      store._asked.next(id);
      return null;
    },

    _resolve: rxMethod<readonly string[]>(
      pipe(
        mergeMap((requested) =>
          store._api.personNames(requested).pipe(
            catchError(() => of<PersonName[]>([])),
            map((found): Answer => ({ requested, found })),
          ),
        ),
        tap((answer) => {
          patchState(store, (state) => ({ names: withAnswer(state.names, answer) }));
        }),
      ),
    ),
  })),
  withHooks({
    onInit(store) {
      const fresh = store._asked.pipe(distinct(), share());
      store._resolve(
        fresh.pipe(
          buffer(fresh.pipe(debounceTime(0, asapScheduler))),
          filter((ids) => ids.length > 0),
          mergeMap((ids) => from(chunks(ids, MAX_IDS))),
        ),
      );
    },
  }),
);

/** The instance type of {@link PersonNamesStore}. */
export type PersonNamesStore = InstanceType<typeof PersonNamesStore>;
