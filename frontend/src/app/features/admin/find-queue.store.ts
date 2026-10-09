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
import { concatMap, filter, from, mergeMap, type Observable, pipe, switchMap, tap } from 'rxjs';
import { FindsApi } from '../../core/api/finds.api';
import { PhotosApi } from '../../core/api/photos.api';
import { AuthService } from '../../core/auth';
import type { OpenFind, Photo } from '../../core/api/models';
import { trigger } from './write';

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

/** Takes the card `id` away again when its undo fails: the server kept the decision. */
export function redone(
  stack: readonly OpenFind[] | null,
  decided: number,
  id: string,
): Pick<FindQueueState, 'decided'> | null {
  return stack?.[decided]?.id === id ? { decided: decided + 1 } : null;
}

/** A decision, or `null` to take the decision back. */
interface QueueWrite {
  readonly id: string;
  readonly decision: Decision | null;
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

    const settle = (request: QueueWrite, sent: Observable<unknown>): Observable<unknown> =>
      sent.pipe(
        tapResponse({
          next: () => undefined,
          error: () => {
            const back = request.decision === null ? redone : restored;
            patchState(store, ({ stack, decided }) => back(stack, decided, request.id) ?? {});
          },
        }),
      );
    // One write after the other, so that an undo always comes after its decision.
    const write = rxMethod<QueueWrite>(
      pipe(
        concatMap((request) =>
          settle(
            request,
            request.decision === null
              ? store._api.reopen(request.id)
              : store._api.review(request.id, request.decision),
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

      /** Sends a decision. The card goes away at once and comes back when the write fails. */
      review(request: ReviewWrite): void {
        patchState(store, ({ decided }) => ({ decided: decided + 1 }));
        write(request);
      },

      /** Takes the last decision back on the server too. The card comes back at once. */
      undo(): void {
        const id = store.stack()?.[store.decided() - 1]?.id;
        if (id === undefined) return;
        patchState(store, ({ decided }) => ({ decided: decided - 1 }));
        write({ id, decision: null });
      },
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
