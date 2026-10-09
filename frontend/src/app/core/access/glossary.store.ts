import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, of, pipe, switchMap, tap, type Observable } from 'rxjs';
import { GlossaryApi } from '../api/glossary.api';
import type { GlossaryEntry, GlossaryEntryWrite } from '../api/models';
import { confirmed, settle, withSearchableList } from '../state';

/** The glossary in memory. The account and the administration read the same list. */
export const GlossaryStore = signalStore(
  { providedIn: 'root' },
  withSearchableList<GlossaryEntry>({
    matches: (entry, needle) =>
      `${entry.term} ${entry.definition} ${entry.definitionEn}`.toLocaleLowerCase().includes(needle),
    sortKey: (entry) => entry.term,
  }),
  // `failed` tells a load error apart from an empty glossary.
  withState({ writing: false, failed: false }),
  withProps(({ items }) => ({ entries: items, _api: inject(GlossaryApi) })),
  withMethods((store) => {
    const fetch = rxMethod<null>(
      pipe(
        tap(() => {
          patchState(store, { failed: false });
        }),
        switchMap(() =>
          store._api.list().pipe(
            catchError(() => {
              patchState(store, { failed: true });
              return of<GlossaryEntry[]>([]);
            }),
          ),
        ),
        tap((entries) => {
          store.setItems(entries);
        }),
      ),
    );

    /** Runs one write. `writing` is true while it runs; `done` gets a success only. */
    async function write<T>(request: Observable<T>, done: (value: T) => void): Promise<T | null> {
      patchState(store, { writing: true });
      const value = await settle(request);
      if (value !== null) done(value);
      patchState(store, { writing: false });
      return value;
    }

    const keep = (entry: GlossaryEntry): void => {
      store.put(entry);
    };

    return {
      load(): void {
        fetch(null);
      },
      create(entry: GlossaryEntryWrite): Promise<GlossaryEntry | null> {
        return write(store._api.create(entry), keep);
      },
      update(id: string, entry: GlossaryEntryWrite): Promise<GlossaryEntry | null> {
        return write(store._api.update(id, entry), keep);
      },
      /** True when the service deleted the entry. */
      async remove(id: string): Promise<boolean> {
        const done = await write(confirmed(store._api.remove(id)), () => {
          store.drop(id);
        });
        return done === true;
      },
    };
  }),
);

/** The instance type of {@link GlossaryStore}. */
export type GlossaryStore = InstanceType<typeof GlossaryStore>;

/** The definition in the UI language. An entry without English text shows the German text. */
export function glossaryText(entry: GlossaryEntry, locale: string): string {
  return locale !== 'de' && entry.definitionEn !== '' ? entry.definitionEn : entry.definition;
}
