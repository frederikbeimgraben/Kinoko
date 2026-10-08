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
  /** The share of the running upload. `null` means that no upload runs. */
  percent: number | null;
  /** True while a submission without network waits on the device. */
  queued: boolean;
}

/** The photos of one view: load, submit, review and set the lead photo. */
export const ImagesStore = signalStore(
  { providedIn: 'root' },
  withState<ImagesState>({ photos: [], cursor: null, percent: null, queued: false }),
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
      /** Gets a view again. A second query replaces the first. `null` waits for a query. */
      load: rxMethod<PhotoQuery | null>(
        pipe(
          filter((query): query is PhotoQuery => query !== null),
          tap(() => {
            patchState(store, setLoading());
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
