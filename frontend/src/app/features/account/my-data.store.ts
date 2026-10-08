import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, of, pipe, switchMap, tap } from 'rxjs';
import { AccessApi } from '../../core/api/access.api';
import type { AccountExport } from '../../core/api/models';
import { AuthService } from '../../core/auth';
import { OfflineStore } from '../../core/offline/offline-store';
import { SyncStore } from '../../core/offline/sync.store';
import { confirmed, settle } from '../../core/state';
import { EntriesStore } from '../entries/entries.store';

/** The counts of the own data, as the stat tiles and the export sheet show them. */
export interface DataCounts {
  readonly finds: number;
  readonly markers: number;
  readonly zones: number;
  readonly photos: number;
  readonly combinations: number;
}

interface MyDataState {
  /** `null` while the export is not known. */
  data: AccountExport | null;
  deleting: boolean;
}

/** The counts of an export. */
export function countsOf(data: AccountExport): DataCounts {
  return {
    finds: data.finds.length,
    markers: data.markers.length,
    zones: data.zones.length,
    photos: data.photos.length,
    combinations: data.combinations.length,
  };
}

/** The own data of the account: the counts, the export and the full delete. */
export const MyDataStore = signalStore(
  { providedIn: 'root' },
  withState<MyDataState>({ data: null, deleting: false }),
  withProps(() => ({
    _api: inject(AccessApi),
    _auth: inject(AuthService),
    _entries: inject(EntriesStore),
    _offline: inject(OfflineStore),
    _sync: inject(SyncStore),
  })),
  withComputed(({ data }) => ({
    /** `null` while the export loads: the tiles then show a skeleton. */
    counts: computed<DataCounts | null>(() => {
      const known = data();
      return known === null ? null : countsOf(known);
    }),
  })),
  withMethods((store) => ({
    /** Reads the export when a person is signed in. A failure keeps the last known data. */
    _follow: rxMethod<boolean>(
      pipe(
        switchMap((signedIn) =>
          signedIn ? store._api.exportData().pipe(catchError(() => of(undefined))) : of(null),
        ),
        tap((data) => {
          if (data !== undefined) patchState(store, { data });
        }),
      ),
    ),

    /** Deletes all own data in the service and on the device. True on success. */
    async deleteAll(): Promise<boolean> {
      patchState(store, { deleting: true });
      const done = (await settle(confirmed(store._api.deleteData()))) === true;
      if (done) {
        await Promise.all([store._offline.clear('objects'), store._offline.clear('queue')]);
        await store._sync.read();
        await store._entries.load();
      }
      patchState(store, ({ data }) => ({
        deleting: false,
        data: done && data !== null ? { me: data.me, finds: [], markers: [], zones: [], photos: [], combinations: [] } : data,
      }));
      return done;
    },
  })),
  withHooks({
    onInit(store) {
      store._follow(store._auth.signedIn);
    },
  }),
);

/** The instance type of {@link MyDataStore}. */
export type MyDataStore = InstanceType<typeof MyDataStore>;
