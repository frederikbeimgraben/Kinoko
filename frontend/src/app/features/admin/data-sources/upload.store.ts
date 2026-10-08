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
import {
  EMPTY,
  Subject,
  catchError,
  exhaustMap,
  expand,
  filter,
  ignoreElements,
  map,
  mergeMap,
  pipe,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { DataSourcesApi } from '../../../core/api/data-sources.api';
import type { UploadSession } from '../../../core/api/models';
import { withStorageSync } from '../../../core/state';
import { finish, trigger, type AfterWrite } from '../write';
import { FILE_HASHER } from './hash-file';
import { uploadEnds, type UploadStoreState } from './upload-ends';
import {
  SETTLING,
  codeOf,
  dropSession,
  ownedSession,
  sendPart,
  sessionFor,
  type UploadStart,
} from './upload-parts';
import {
  INITIAL_UPLOAD,
  asResumeRecord,
  factsOf,
  isActive,
  readyToComplete,
  reduce,
  resumeRecord,
  type ResumeRecord,
  type UploadEvent,
} from './upload-machine';

export type { UploadStart } from './upload-parts';

/** The storage key of the open upload. */
const STORAGE_KEY = 'pilzkarte.datenquellen.upload';

/** One upload at a time: resumable parts, a hash in a worker and the state of the new version. */
export const UploadStore = signalStore(
  { providedIn: 'root' },
  withState<UploadStoreState>({ upload: INITIAL_UPLOAD, saved: null }),
  withStorageSync<UploadStoreState, ResumeRecord>({
    key: STORAGE_KEY,
    select: (state) => state.saved,
    restore: (stored) => {
      const saved = asResumeRecord(stored);
      return saved === null ? null : { saved };
    },
  }),
  withComputed(({ upload }) => ({
    phase: computed(() => upload().phase),
    active: computed(() => isActive(upload().phase)),
    _complete: computed(() => readyToComplete(upload())),
    /** The id of a new version that still changes. A string keeps the poll alive across state updates. */
    _settling: computed(() => {
      const version = upload().version;
      return version !== null && SETTLING.includes(version.state) ? version.id : null;
    }),
  })),
  withProps(() => ({
    _api: inject(DataSourcesApi),
    _hasher: inject(FILE_HASHER),
    _stop: new Subject<void>(),
    /** The start request that owns the state. An answer to an older request is stale. */
    _run: { request: null as UploadStart | null },
  })),
  withProps((store) => ({
    _apply: (event: UploadEvent): void => {
      patchState(store, ({ upload, saved }) => {
        const next = reduce(upload, event);
        const ended = next.phase === 'done' || next.phase === 'cancelled';
        return { upload: next, saved: ended ? null : (resumeRecord(next) ?? saved) };
      });
    },
  })),
  withMethods((store) => uploadEnds(store)),
  withMethods((store) => {
    const apply = store._apply;

    const part = () =>
      sendPart(store._api, store.upload, store._run.request?.file ?? null, (attempt) => {
        apply({ type: 'retry', attempt });
      }).pipe(
        tap((answer) => {
          apply({ type: 'sent', received: answer.receivedBytes, at: Date.now() });
        }),
      );

    const pump = trigger(
      rxMethod<true>(
        pipe(
          exhaustMap(() =>
            part().pipe(
              expand(() => part()),
              takeUntil(store._stop),
              catchError((failure: unknown) => {
                apply({ type: 'failed', code: codeOf(failure) });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),
    );

    const hash = rxMethod<File>(
      pipe(
        switchMap((file) => store._hasher(file).pipe(takeUntil(store._stop))),
        tap((reply) => {
          if ('done' in reply) apply({ type: 'hashed', bytes: reply.done });
          else if ('hex' in reply) apply({ type: 'digest', hex: reply.hex });
          else apply({ type: 'failed', code: reply.error });
        }),
      ),
    );

    /** Starts the parts and the hash for a session that the server has. */
    const begin = (session: UploadSession, file: File): void => {
      apply({ type: 'created', session, at: Date.now() });
      hash(file);
      pump();
    };

    /** True while the request owns the state and waits for its session. */
    const owns = (request: UploadStart): boolean =>
      store._run.request === request && store.upload().phase === 'creating';

    const stop = rxMethod<AfterWrite>(
      pipe(
        filter(() => store.upload().phase !== 'completing'),
        map((request) => ({ request, id: ownedSession(store.upload(), store.saved()) })),
        tap(() => {
          store._stop.next();
          apply({ type: 'cancel' });
          store._run.request = null;
        }),
        mergeMap(({ request, id }) =>
          dropSession(store._api, id).pipe(
            tap(() => {
              finish(request);
            }),
          ),
        ),
      ),
    );

    return {
      start: rxMethod<UploadStart>(
        pipe(
          filter(() => !isActive(store.upload().phase)),
          tap((request) => {
            store._run.request = request;
            apply({
              type: 'start',
              kind: request.kind,
              file: factsOf(request.file),
              activate: request.activate,
            });
          }),
          // A cancel or a new start can come before the answer. The stale session then goes back to the server.
          mergeMap((request) =>
            sessionFor(store._api, store.saved(), request).pipe(
              map((session) => ({ session, current: owns(request) })),
              tapResponse({
                next: ({ session, current }) => {
                  if (current) begin(session, request.file);
                },
                error: (failure: unknown) => {
                  if (owns(request)) apply({ type: 'failed', code: codeOf(failure) });
                },
              }),
              filter(({ current }) => !current),
              mergeMap(({ session }) => dropSession(store._api, session.id)),
              ignoreElements(),
            ),
          ),
        ),
      ),

      pause(): void {
        apply({ type: 'pause' });
      },

      resume(): void {
        if (store.upload().phase !== 'paused') return;
        apply({ type: 'resume', at: Date.now() });
        pump();
      },

      /** Stops the parts and the hash, and asks the server to drop the session. */
      cancel(request: AfterWrite = {}): void {
        stop(request);
      },

      /** Forgets an upload that ended, so that the dialog can start a new one. */
      reset(): void {
        apply({ type: 'reset' });
      },
    };
  }),
  withHooks({
    onInit(store) {
      store._finish(store._complete);
      store._watch(store._settling);
    },
  }),
);

/** The instance type of {@link UploadStore}. */
export type UploadStore = InstanceType<typeof UploadStore>;
