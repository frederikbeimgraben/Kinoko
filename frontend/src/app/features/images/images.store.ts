import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { filter, firstValueFrom, lastValueFrom, pipe, switchMap, tap, type Observable } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { PhotosApi, type PhotoInput, type PhotoQuery } from '../../core/api/photos.api';
import type { Photo } from '../../core/api/models';
import { withoutMetadata } from '../../core/images/prepare-photo';
import { SyncStore } from '../../core/offline/sync.store';
import { setFailed, setLoaded, setLoading, withLoadState } from '../../core/state';

interface ImagesState {
  photos: readonly Photo[];
  cursor: string | null;
  /** The query of the shown view. `null` before the first load. */
  query: PhotoQuery | null;
  /** The share of the running upload. `null` means that no upload runs. */
  percent: number | null;
  /** True when the last submission went into the queue of the device, because there was no network. */
  queued: boolean;
}

/** The photos of one view: load, submit, review and set the lead photo. */
export const ImagesStore = signalStore(
  { providedIn: 'root' },
  withState<ImagesState>({ photos: [], cursor: null, query: null, percent: null, queued: false }),
  withLoadState(),
  withProps(() => ({ _api: inject(PhotosApi), _sync: inject(SyncStore) })),
  withComputed(({ photos }) => ({
    lead: computed<Photo | null>(() => photos().find((one) => one.lead) ?? photos().at(0) ?? null),
  })),
  withMethods((store) => {
    /** A decided photo leaves the view that showed it. */
    const settle = async (id: string, call: Observable<unknown>): Promise<void> => {
      const done = await firstValueFrom(call).then(
        () => true,
        () => false,
      );
      if (done) patchState(store, ({ photos }) => ({ photos: photos.filter((one) => one.id !== id) }));
    };

    return {
      /** Gets a view again. A second query replaces the first. `null` waits for a query.
       * The photos of the old view go at the start, so that no view shows the photos of another. */
      load: rxMethod<PhotoQuery | null>(
        pipe(
          filter((query): query is PhotoQuery => query !== null),
          tap((query) => {
            patchState(store, { photos: [], cursor: null, query }, setLoading());
          }),
          switchMap((query) =>
            store._api.list(query).pipe(
              tapResponse({
                next: (page) => {
                  patchState(store, { photos: page.items, cursor: page.nextCursor }, setLoaded());
                },
                error: () => {
                  patchState(store, setFailed());
                },
              }),
            ),
          ),
        ),
      ),

      photoOf(id: string): Photo | null {
        return store.photos().find((one) => one.id === id) ?? null;
      },

      /** The position in the view, from one. Zero means that the view does not have the photo. */
      positionOf(id: string): number {
        return store.photos().findIndex((one) => one.id === id) + 1;
      },

      /** Prepares the photo and sends it. Without network it waits in the queue. */
      async submit(input: PhotoInput, file: File): Promise<Photo | null> {
        const prepared = await withoutMetadata(file);
        patchState(store, { queued: false });
        if (!store._sync.online()) {
          await store._sync.enqueue('photo', 'create', { ...input }, [prepared]);
          patchState(store, { queued: true });
          return null;
        }
        patchState(store, { percent: 0 });
        const upload = store._api.create(input, prepared).pipe(
          tap((step) => {
            patchState(store, { percent: step.percent });
          }),
        );
        const done = await lastValueFrom(upload).then(
          (last) => last.body,
          () => null,
        );
        patchState(store, { percent: null });
        return done;
      },

      approve(id: string): Promise<void> {
        return settle(id, store._api.approve(id));
      },

      reject(id: string, reason: string): Promise<void> {
        return settle(id, store._api.reject(id, reason));
      },

      /** Takes back a decision. `false` means that the service kept it. */
      reopen(id: string): Promise<boolean> {
        return firstValueFrom(store._api.reopen(id)).then(
          () => true,
          () => false,
        );
      },

      remove(id: string): Promise<void> {
        return settle(id, store._api.remove(id));
      },

      /** A new lead photo replaces the old one: each species has one lead. */
      async setLead(id: string): Promise<void> {
        const done = await firstValueFrom(store._api.setLead(id)).then(
          () => true,
          () => false,
        );
        if (done) {
          patchState(store, ({ photos }) => ({
            photos: photos.map((one) => ({ ...one, lead: one.id === id })),
          }));
        }
      },
    };
  }),
);

/** The instance type of {@link ImagesStore}. */
export type ImagesStore = InstanceType<typeof ImagesStore>;
