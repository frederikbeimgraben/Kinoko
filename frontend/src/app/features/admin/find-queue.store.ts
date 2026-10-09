import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
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
import { exhaustMap, filter, from, mergeMap, pipe, switchMap, tap } from 'rxjs';
import { FindsApi } from '../../core/api/finds.api';
import { PhotosApi } from '../../core/api/photos.api';
import { AuthService } from '../../core/auth';
import type { OpenFind, Photo } from '../../core/api/models';
import { type AfterWrite, finish, trigger } from './write';

/** The decision about a find. */
export type Decision = 'accepted' | 'rejected';

/** The number of cards after the top card that get their photos early. */
const PHOTO_LEAD = 2;

interface FindQueueState {
  /** The open finds when the queue starts. `null` while the first response is pending. */
  stack: readonly OpenFind[] | null;
  /** The number of cards with a decision. A decision does not make the stack shorter. */
  decided: number;
  photos: Readonly<Record<string, readonly Photo[]>>;
}

/** A decision about the find `id`. */
export interface ReviewWrite {
  readonly id: string;
  readonly decision: Decision;
}

/** Puts the find `id` back as the first open card after a failed decision. Other decisions stay. */
export function restored(
  stack: readonly OpenFind[] | null,
  decided: number,
  id: string,
): Pick<FindQueueState, 'stack' | 'decided'> | null {
  const all = stack ?? [];
  const index = all.findIndex((one) => one.id === id);
  if (index < 0 || index >= decided) return null;
  const rest = all.filter((one) => one.id !== id);
  return {
    stack: [...rest.slice(0, decided - 1), all[index], ...rest.slice(decided - 1)],
    decided: decided - 1,
  };
}

/** The review queue of the finds, with the photos of each find. */
export const FindQueueStore = signalStore(
  { providedIn: 'root' },
  withState<FindQueueState>({ stack: null, decided: 0, photos: {} }),
  withComputed(({ stack, decided }) => ({
    open: computed(() => (stack() ?? []).slice(decided())),
    loaded: computed(() => stack() !== null),
    _upcoming: computed(() => (stack() ?? []).slice(decided(), decided() + PHOTO_LEAD).map((one) => one.id)),
  })),
  withProps(() => ({ _api: inject(FindsApi), _auth: inject(AuthService), _photosApi: inject(PhotosApi) })),
  withMethods((store) => {
    const loadPhotos = rxMethod<string>(
      pipe(
        filter((id) => !(id in store.photos())),
        tap((id) => {
          patchState(store, ({ photos }) => ({ photos: { ...photos, [id]: [] } }));
        }),
        mergeMap((id) =>
          store._photosApi.list({ findId: id }).pipe(
            tapResponse({
              next: (page) => {
                patchState(store, ({ photos }) => ({ photos: { ...photos, [id]: page.items } }));
              },
              error: () => undefined,
            }),
          ),
        ),
      ),
    );

    return {
      /** Gets the photos of a find once. A second call has no effect. */
      loadPhotos,

      _follow: rxMethod<readonly string[]>(
        pipe(
          mergeMap((ids) => from(ids)),
          tap((id) => {
            loadPhotos(id);
          }),
        ),
      ),

      load: trigger(
        rxMethod<true>(
          pipe(
            tap(() => {
              patchState(store, { stack: null, decided: 0 });
            }),
            switchMap(() =>
              store._api.open().pipe(
                tapResponse({
                  next: (stack) => {
                    patchState(store, { stack });
                  },
                  error: () => {
                    patchState(store, { stack: [] });
                  },
                }),
              ),
            ),
          ),
        ),
      ),

      review: rxMethod<ReviewWrite>(
        pipe(
          tap(() => {
            patchState(store, ({ decided }) => ({ decided: decided + 1 }));
          }),
          mergeMap((request) =>
            store._api.review(request.id, request.decision).pipe(
              tapResponse({
                next: () => undefined,
                error: () => {
                  patchState(store, ({ stack, decided }) => restored(stack, decided, request.id) ?? {});
                },
              }),
            ),
          ),
        ),
      ),

      /** Takes the last decision back. The server keeps it, so a new decision overwrites it. */
      undo(): void {
        patchState(store, ({ decided }) => ({ decided: Math.max(0, decided - 1) }));
      },

      acceptAll: rxMethod<AfterWrite>(
        pipe(
          exhaustMap((request) =>
            store._api.acceptAll().pipe(
              tapResponse({
                next: () => {
                  patchState(store, { stack: [], decided: 0 });
                  finish(request);
                },
                error: () => undefined,
              }),
            ),
          ),
        ),
      ),
    };
  }),
  withHooks({
    onInit(store) {
      store._follow(store._upcoming);
    },
  }),
);

/** The instance type of {@link FindQueueStore}. */
export type FindQueueStore = InstanceType<typeof FindQueueStore>;
