import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, exhaustMap, of, pipe, tap } from 'rxjs';
import type { Photo } from '../../core/api/models';
import { PhotosApi, type PhotoPage } from '../../core/api/photos.api';

interface MyImagesState {
  /** `null` while the first page is pending. */
  photos: readonly Photo[] | null;
  /** The cursor of the next page, `null` at the end of the list. */
  cursor: string | null;
  busy: boolean;
}

/** The own photos and their review state. The pages come one after the other, by cursor. */
export const MyImagesStore = signalStore(
  { providedIn: 'root' },
  withState<MyImagesState>({ photos: null, cursor: null, busy: false }),
  withProps(() => ({ _api: inject(PhotosApi) })),
  withComputed(({ photos, cursor }) => ({
    loaded: computed(() => photos() !== null),
    more: computed(() => cursor() !== null),
    /** The finds with an own photo. */
    findIds: computed<ReadonlySet<string>>(
      () => new Set((photos() ?? []).flatMap((photo) => (photo.findId ? [photo.findId] : []))),
    ),
  })),
  withMethods((store) => {
    // A call while a page loads has no effect.
    const page = rxMethod<{ fresh: boolean }>(
      pipe(
        exhaustMap(({ fresh }) => {
          const cursor = fresh ? undefined : (store.cursor() ?? undefined);
          patchState(store, { busy: true });
          return store._api.list({ mine: true, cursor }).pipe(
            catchError(() => of<PhotoPage | null>(null)),
            tap((answer) => {
              if (answer === null) {
                patchState(store, ({ photos }) => ({ busy: false, photos: photos ?? [] }));
                return;
              }
              patchState(store, ({ photos }) => ({
                photos: [...(fresh ? [] : (photos ?? [])), ...answer.items],
                cursor: answer.nextCursor,
                busy: false,
              }));
            }),
          );
        }),
      ),
    );
    return {
      /** Reads the first page again. */
      load(): void {
        page({ fresh: true });
      },
      next(): void {
        if (store.more()) page({ fresh: false });
      },
    };
  }),
);

/** The instance type of {@link MyImagesStore}. */
export type MyImagesStore = InstanceType<typeof MyImagesStore>;
