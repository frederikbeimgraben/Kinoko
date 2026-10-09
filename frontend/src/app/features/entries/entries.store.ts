import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { firstValueFrom, tap, type Observable } from 'rxjs';
import { EntriesApi } from '../../core/api/entries.api';
import { FindsApi } from '../../core/api/finds.api';
import { PhotosApi } from '../../core/api/photos.api';
import type { Find, FindWrite, Marker, MarkerWrite, Zone, ZoneWrite } from '../../core/api/models';
import { AuthService } from '../../core/auth';
import { SyncStore } from '../../core/offline/sync.store';
import type { SyncKind, SyncOperation, SyncTask } from '../../core/offline/sync.types';
import { setFailed, setLoaded, setLoading, withLoadState } from '../../core/state';
import type { Viewbox } from '../../map/tile-grid';
import { EntriesCache } from './entries.cache';
import type { EntriesState, EntryBody, ItemOf, OwnList, SaveResult } from './entries.types';
import { NO_FILTER, type EntriesFilter } from './entry-filter';
import { attachPhotos } from './photos';
import { NOT_FOUND, retryable, statusOf } from './retry';
import { findWrite, markerWrite, zoneWrite } from './writes';

export type { EntryBody, SaveResult } from './entries.types';

/** The own entries in memory: the map, the list and the object sheets read the same signals.
 * A save asks for a sign-in first. Without a sign-in or without network the entry goes
 * into the queue, and the list marks it as "transfer pending". */
export const EntriesStore = signalStore(
  { providedIn: 'root' },
  withState<EntriesState>({ finds: [], markers: [], zones: [], shared: [], filter: NO_FILTER }),
  withLoadState(),
  withProps(() => ({
    _api: inject(EntriesApi),
    _findsApi: inject(FindsApi),
    _photosApi: inject(PhotosApi),
    _auth: inject(AuthService),
    _sync: inject(SyncStore),
    _cache: inject(EntriesCache),
  })),
  withComputed(({ _auth, _sync }) => ({
    /** Only a new object has a row of its own. */
    pendingEntries: computed(
      () => _sync.tasks().filter((task) => task.operation === 'create') as readonly SyncTask<EntryBody>[],
    ),
    /** The ids of the objects with a pending change. */
    pendingTargets: _sync.pendingTargets,
    signedIn: _auth.signedIn,
    /** The name at an own find comes from the account, never from a field. */
    reporter: computed(() => _auth.user()?.name ?? null),
  })),
  withMethods((store) => {
    /** The last state of the device, before the service answers. */
    async function restore(): Promise<void> {
      const known = await store._cache.read();
      if (known !== null)
        patchState(store, { finds: known.finds, markers: known.markers, zones: known.zones });
    }

    /** Puts a task into the queue. `false` means: the device has no space. */
    async function queue(
      kind: SyncKind,
      operation: SyncOperation,
      body: EntryBody | null,
      target?: string,
      photos: readonly File[] = [],
    ): Promise<boolean> {
      return (await store._sync.enqueue(kind, operation, body, photos, target)) !== null;
    }

    /** Without space on the device the entry is lost, and the result says so. */
    async function enqueue(
      kind: SyncKind,
      body: EntryBody,
      photos: readonly File[] = [],
    ): Promise<SaveResult> {
      return (await queue(kind, 'create', body, undefined, photos)) ? 'wartet' : 'verworfen';
    }

    function patchList<K extends OwnList>(
      list: K,
      next: (items: readonly ItemOf<K>[]) => readonly ItemOf<K>[],
    ): void {
      patchState(store, (state) => ({ [list]: next(state[list] as readonly ItemOf<K>[]) }));
    }

    /** Sends a new entry after the sign-in. Without an account or network it goes into the queue one time.
     * A refused body never goes into the queue. A failed photo does not queue the saved find again. */
    async function save<K extends OwnList>(
      kind: SyncKind,
      list: K,
      body: EntryBody,
      send: () => Observable<ItemOf<K> | null>,
      photos: readonly File[] = [],
    ): Promise<SaveResult> {
      let queued: Promise<SaveResult> | null = null;
      const keep = (): Promise<SaveResult> => (queued ??= enqueue(kind, body, photos));
      // The sign-in sheet keeps the entry on the device before the page goes to the SSO.
      if (!(await store._auth.requestSignIn(keep))) return keep();
      const { fresh, failure } = await firstValueFrom(send()).then(
        (item) => ({ fresh: item, failure: undefined }),
        (error: unknown) => ({ fresh: null, failure: error }),
      );
      if (failure !== undefined) return retryable(failure) ? keep() : 'abgelehnt';
      if (fresh === null) return 'gespeichert';
      await attachPhotos(store._photosApi, fresh.id, store.reporter() ?? '', photos);
      patchList(list, (items) => [fresh, ...items]);
      return 'gespeichert';
    }

    /** Changes the list first. Without network the change goes into the queue. */
    async function change<K extends OwnList, B extends EntryBody>(
      kind: SyncKind,
      list: K,
      id: string,
      body: B,
      send: (body: B) => Observable<ItemOf<K> | null>,
    ): Promise<boolean> {
      try {
        const fresh = await firstValueFrom(send(body));
        if (fresh !== null) patchList(list, (items) => items.map((one) => (one.id === id ? fresh : one)));
        return true;
      } catch (failure) {
        if (!retryable(failure)) return false;
        patchList(list, (items) => items.map((one) => (one.id === id ? { ...one, ...body } : one)));
        return queue(kind, 'update', body, id);
      }
    }

    async function drop(
      kind: SyncKind,
      list: OwnList,
      id: string,
      send: () => Observable<unknown>,
    ): Promise<boolean> {
      const before = store[list]();
      patchList(list, (items) => items.filter((one) => one.id !== id));
      try {
        await firstValueFrom(send());
        return true;
      } catch (failure) {
        if (retryable(failure)) return queue(kind, 'delete', null, id);
        // A 404 means that the entry is already gone. Other answers keep it.
        if (statusOf(failure) === NOT_FOUND) return true;
        patchState(store, { [list]: before });
        return false;
      }
    }

    /** Sends what waits, then gets the own entries again. */
    async function sendPending(): Promise<number> {
      const sent = store._auth.signedIn() ? await store._sync.flush() : 0;
      if (sent > 0) await load();
      return sent;
    }

    async function load(): Promise<void> {
      await store._sync.read();
      if (!store._auth.signedIn()) {
        patchState(store, { finds: [], markers: [], zones: [] });
        return;
      }
      await restore();
      patchState(store, setLoading());
      try {
        const [finds, markers, zones] = await Promise.all([
          firstValueFrom(store._api.finds()),
          firstValueFrom(store._api.markers()),
          firstValueFrom(store._api.zones()),
        ]);
        patchState(store, { finds, markers, zones }, setLoaded());
        await store._cache.write({ finds, markers, zones });
      } catch {
        // A failure keeps what is already there.
        patchState(store, setFailed());
      }
    }

    return {
      /** Gets all own entries. Without an account there is nothing to get. */
      load,

      /** At each change of the sign-in: gets the own entries again and sends what waits in the queue. */
      loadOnSignIn: rxMethod<boolean>(
        tap(() => {
          void load().then(sendPending);
        }),
      ),

      /** Shared finds in the view. This route reads also without an account. */
      async loadShared(view?: Viewbox): Promise<void> {
        try {
          patchState(store, { shared: await firstValueFrom(store._findsApi.shared(view)) });
        } catch {
          // Without network the map keeps what came last.
        }
      },

      setFilter(filter: EntriesFilter): void {
        patchState(store, { filter });
      },

      saveFind(body: FindWrite, photos: readonly File[] = []): Promise<SaveResult> {
        return save('find', 'finds', body, () => store._api.createFind(body), photos);
      },

      saveMarker(body: MarkerWrite): Promise<SaveResult> {
        return save('marker', 'markers', body, () => store._api.createMarker(body));
      },

      saveZone(body: ZoneWrite): Promise<SaveResult> {
        return save('zone', 'zones', body, () => store._api.createZone(body));
      },

      /** Changes a find. `PUT` replaces, so the full body goes out. */
      updateFind(find: Find, update: Partial<FindWrite>): Promise<boolean> {
        return change('find', 'finds', find.id, { ...findWrite(find), ...update }, (body) =>
          store._api.putFind(find.id, body),
        );
      },

      updateMarker(marker: Marker, update: Partial<MarkerWrite>): Promise<boolean> {
        return change('marker', 'markers', marker.id, { ...markerWrite(marker), ...update }, (body) =>
          store._api.putMarker(marker.id, body),
        );
      },

      updateZone(zone: Zone, update: Partial<ZoneWrite>): Promise<boolean> {
        return change('zone', 'zones', zone.id, { ...zoneWrite(zone), ...update }, (body) =>
          store._api.putZone(zone.id, body),
        );
      },

      deleteFind(id: string): Promise<boolean> {
        return drop('find', 'finds', id, () => store._api.deleteFind(id));
      },

      deleteMarker(id: string): Promise<boolean> {
        return drop('marker', 'markers', id, () => store._api.deleteMarker(id));
      },

      deleteZone(id: string): Promise<boolean> {
        return drop('zone', 'zones', id, () => store._api.deleteZone(id));
      },

      sendPending,
    };
  }),
);

/** The instance type of {@link EntriesStore}. */
export type EntriesStore = InstanceType<typeof EntriesStore>;
