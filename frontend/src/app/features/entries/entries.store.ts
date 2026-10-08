import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { firstValueFrom, tap, type Observable } from 'rxjs';
import { EntriesApi } from '../../core/api/entries.api';
import { FindsApi } from '../../core/api/finds.api';
import { PhotosApi } from '../../core/api/photos.api';
import type {
  Find,
  FindWrite,
  Marker,
  MarkerWrite,
  SharedFind,
  Zone,
  ZoneWrite,
} from '../../core/api/models';
import { AuthService } from '../../core/auth';
import { SyncStore } from '../../core/offline/sync.store';
import type { SyncKind, SyncOperation, SyncTask } from '../../core/offline/sync.types';
import { setFailed, setLoaded, setLoading, withLoadState } from '../../core/state';
import type { Viewbox } from '../../map/tile-grid';
import { EntriesCache } from './entries.cache';
import { NO_FILTER, type EntriesFilter } from './entry-filter';
import { attachPhotos } from './photos';
import { findWrite, markerWrite, zoneWrite } from './writes';

/** The result of a save. */
export type SaveResult = 'gespeichert' | 'wartet' | 'verworfen';

/** The body that an object carries on the wire. */
export type EntryBody = FindWrite | MarkerWrite | ZoneWrite;

interface EntriesState {
  finds: readonly Find[];
  markers: readonly Marker[];
  zones: readonly Zone[];
  /** Shared finds in the last asked view, also of other people. */
  shared: readonly SharedFind[];
  /** The filter of the entry list. */
  filter: EntriesFilter;
}

/** The three own lists, by the name of their state field. */
type OwnList = 'finds' | 'markers' | 'zones';

type Listed<K extends OwnList> = EntriesState[K][number];

/**
 * The own entries in memory. No page owns them: the map, the list and the object sheets
 * read the same signals, so that a new find shows at all places at once.
 * A save asks for a sign-in first. Without a sign-in or without network the entry goes
 * into the queue, and the list marks it as "transfer pending".
 */
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
      if (known !== null) patchState(store, { finds: known.finds, markers: known.markers, zones: known.zones });
    }

    function keep(): Promise<void> {
      return store._cache.write({ finds: store.finds(), markers: store.markers(), zones: store.zones() });
    }

    /** Without space on the device the entry is lost, and the result says so. */
    async function enqueue(kind: SyncKind, body: EntryBody, photos: readonly File[] = []): Promise<SaveResult> {
      return (await store._sync.enqueue(kind, 'create', body, photos)) === null ? 'verworfen' : 'wartet';
    }

    /** Without network the change goes into the queue and is not lost. */
    async function queueChange(
      kind: SyncKind,
      operation: SyncOperation,
      id: string,
      body: EntryBody | null,
    ): Promise<boolean> {
      return (await store._sync.enqueue(kind, operation, body, [], id)) !== null;
    }

    function prepend<K extends OwnList>(list: K, item: Listed<K>): void {
      patchState(store, (state) => ({ [list]: [item, ...state[list]] }) as Partial<EntriesState>);
    }

    function replace<K extends OwnList>(list: K, id: string, item: (old: Listed<K>) => Listed<K>): void {
      patchState(
        store,
        (state) =>
          ({
            [list]: (state[list] as readonly Listed<K>[]).map((one) => (one.id === id ? item(one) : one)),
          }) as Partial<EntriesState>,
      );
    }

    function remove(list: OwnList, id: string): void {
      patchState(
        store,
        (state) =>
          ({
            [list]: (state[list] as readonly { id: string }[]).filter((one) => one.id !== id),
          }) as Partial<EntriesState>,
      );
    }

    async function save<K extends 'markers' | 'zones'>(
      kind: SyncKind,
      list: K,
      body: EntryBody,
      send: () => Observable<Listed<K> | null>,
    ): Promise<SaveResult> {
      if (!(await store._auth.requestSignIn())) return enqueue(kind, body);
      try {
        const fresh = await firstValueFrom(send());
        if (fresh !== null) prepend(list, fresh);
        return 'gespeichert';
      } catch {
        return enqueue(kind, body);
      }
    }

    /** Changes the list first. Without network the change goes into the queue. */
    async function change<K extends OwnList, B extends EntryBody>(
      kind: SyncKind,
      list: K,
      id: string,
      body: B,
      send: (body: B) => Observable<Listed<K> | null>,
    ): Promise<boolean> {
      try {
        const fresh = await firstValueFrom(send(body));
        if (fresh !== null) replace(list, id, () => fresh);
        return true;
      } catch {
        replace(list, id, (old) => ({ ...old, ...body }));
        return queueChange(kind, 'update', id, body);
      }
    }

    async function drop(kind: SyncKind, list: OwnList, id: string, send: () => Observable<unknown>): Promise<boolean> {
      remove(list, id);
      try {
        await firstValueFrom(send());
        return true;
      } catch {
        return queueChange(kind, 'delete', id, null);
      }
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
        await keep();
      } catch {
        // A failure keeps what is already there.
        patchState(store, setFailed());
      }
    }

    return {
      /** Gets all own entries. Without an account there is nothing to get. */
      load,

      /** Gets the own entries again at each change of the sign-in: it can come after the first render. */
      loadOnSignIn: rxMethod<boolean>(
        tap(() => {
          void load();
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

      async saveFind(body: FindWrite, photos: readonly File[] = []): Promise<SaveResult> {
        if (!(await store._auth.requestSignIn())) return enqueue('find', body, photos);
        try {
          const find = await firstValueFrom(store._api.createFind(body));
          if (find === null) return 'gespeichert';
          await attachPhotos(store._photosApi, find.id, store.reporter() ?? '', photos);
          prepend('finds', find);
          return 'gespeichert';
        } catch {
          return enqueue('find', body, photos);
        }
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

      /** Sends what waits, then gets the own entries again. */
      async sendPending(): Promise<number> {
        if (!store._auth.signedIn()) return 0;
        const sent = await store._sync.flush();
        if (sent > 0) await load();
        return sent;
      },
    };
  }),
);

/** The instance type of {@link EntriesStore}. */
export type EntriesStore = InstanceType<typeof EntriesStore>;
