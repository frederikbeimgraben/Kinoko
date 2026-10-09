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
import { catchError, EMPTY, expand, filter, of, pipe, reduce, skip, switchMap, tap } from 'rxjs';
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
    return { _api: inject(PhotosApi), _auth: auth, _account: computed(() => auth.user()?.sub ?? null) };
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
    // A fresh load replaces a pending one. A next page while a page loads has no effect.
    const page = rxMethod<{ fresh: boolean }>(
      pipe(
        filter(({ fresh }) => fresh || !store.busy()),
        switchMap(({ fresh }) => {
          const cursor = fresh ? undefined : (store.cursor() ?? undefined);
          patchState(store, { busy: true });
          // A direct page load asks only after the session check; else the first request has no token.
          return store._auth.sessionReady().pipe(
            switchMap(() => store._api.list({ mine: true, cursor })),
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
          store._auth.sessionReady().pipe(
            switchMap(() => store._api.list({ mine: true })),
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
      /** Forgets the photos when the account changes. A list that a page asked for loads again. */
      _reset: rxMethod<string | null>(
        pipe(
          skip(1),
          tap((account) => {
            const asked = store.photos() !== null || store.busy();
            patchState(store, { photos: null, cursor: null, busy: false });
            if (account !== null && asked) page({ fresh: true });
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
