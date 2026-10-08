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
import { catchError, EMPTY, exhaustMap, expand, of, pipe, reduce, skip, switchMap, tap } from 'rxjs';
import type { Photo } from '../../core/api/models';
import { PhotosApi, type PhotoPage } from '../../core/api/photos.api';
import { AuthService } from '../../core/auth';

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
  withProps(() => {
    const auth = inject(AuthService);
    return { _api: inject(PhotosApi), _account: computed(() => auth.user()?.sub ?? null) };
  }),
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
    const all = rxMethod<true>(
      pipe(
        tap(() => {
          patchState(store, { busy: true });
        }),
        switchMap(() =>
          store._api.list({ mine: true }).pipe(
            expand((answer) =>
              answer.nextCursor === null ? EMPTY : store._api.list({ mine: true, cursor: answer.nextCursor }),
            ),
            reduce<PhotoPage, readonly Photo[]>((sum, answer) => [...sum, ...answer.items], []),
            tap((photos) => {
              patchState(store, { photos, cursor: null, busy: false });
            }),
            catchError(() => {
              patchState(store, ({ photos }) => ({ busy: false, photos: photos ?? [] }));
              return EMPTY;
            }),
          ),
        ),
      ),
    );
    return {
      /** Forgets the photos when another person signs in or the person signs out. */
      _reset: rxMethod<string | null>(
        pipe(
          skip(1),
          tap(() => {
            patchState(store, { photos: null, cursor: null });
          }),
        ),
      ),
      /** Reads all pages again, for a filter that must know each own photo. */
      loadAll(): void {
        all(true);
      },
      /** Reads the first page again. */
      load(): void {
        page({ fresh: true });
      },
      next(): void {
        if (store.more()) page({ fresh: false });
      },
    };
  }),
  withHooks({
    onInit(store) {
      store._reset(store._account);
    },
  }),
);

/** The instance type of {@link MyImagesStore}. */
export type MyImagesStore = InstanceType<typeof MyImagesStore>;
