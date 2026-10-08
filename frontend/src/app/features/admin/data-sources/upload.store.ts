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
  map,
  of,
  pipe,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { DataSourcesApi } from '../../../core/api/data-sources.api';
import type { UploadSession } from '../../../core/api/models';
import { withStorageSync } from '../../../core/state';
import { trigger } from '../write';
import { FILE_HASHER } from './hash-file';
import { SETTLING, codeOf, followVersion, sendPart, sessionFor, type UploadStart } from './upload-parts';
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
  type UploadState,
} from './upload-machine';

export type { UploadStart } from './upload-parts';

/** The storage key of the open upload. */
const STORAGE_KEY = 'pilzkarte.datenquellen.upload';

interface UploadStoreState {
  upload: UploadState;
  /** The open session for a reload. It stays until the upload ends. */
  saved: ResumeRecord | null;
}

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
    _file: { current: null as File | null },
  })),
  withMethods((store) => {
    const apply = (event: UploadEvent): void => {
      patchState(store, ({ upload, saved }) => {
        const next = reduce(upload, event);
        const ended = next.phase === 'done' || next.phase === 'cancelled';
        return { upload: next, saved: ended ? null : (resumeRecord(next) ?? saved) };
      });
    };

    const part = () =>
      sendPart(store._api, store.upload, store._file.current, (attempt) => {
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

    return {
      start: rxMethod<UploadStart>(
        pipe(
          filter(() => !isActive(store.upload().phase)),
          tap((request) => {
            store._file.current = request.file;
            apply({
              type: 'start',
              kind: request.kind,
              file: factsOf(request.file),
              activate: request.activate,
            });
          }),
          exhaustMap((request) =>
            sessionFor(store._api, store.saved(), request).pipe(
              tapResponse({
                next: (session) => {
                  begin(session, request.file);
                },
                error: (failure: unknown) => {
                  apply({ type: 'failed', code: codeOf(failure) });
                },
              }),
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
      cancel: trigger(
        rxMethod<true>(
          pipe(
            map(() => store.upload().uploadId),
            tap(() => {
              store._stop.next();
              apply({ type: 'cancel' });
              store._file.current = null;
            }),
            switchMap((id) => (id === null ? EMPTY : store._api.abort(id).pipe(catchError(() => of(null))))),
          ),
        ),
      ),

      /** Forgets an upload that ended, so that the dialog can start a new one. */
      reset(): void {
        apply({ type: 'reset' });
      },

      _finish: rxMethod<boolean>(
        pipe(
          filter((ready) => ready),
          tap(() => {
            apply({ type: 'completing' });
          }),
          exhaustMap(() => {
            const state = store.upload();
            return store._api.complete(state.uploadId ?? '', state.sha256).pipe(
              tapResponse({
                next: (version) => {
                  store._file.current = null;
                  apply({ type: 'completed', version });
                },
                error: (failure: unknown) => {
                  apply({ type: 'failed', code: codeOf(failure) });
                },
              }),
            );
          }),
        ),
      ),

      _watch: rxMethod<string | null>(
        pipe(
          map((id) => (id === null ? null : store.upload().version)),
          switchMap((version) => (version === null ? EMPTY : followVersion(store._api, version))),
          tap((version) => {
            apply({ type: 'version', version });
          }),
        ),
      ),
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
