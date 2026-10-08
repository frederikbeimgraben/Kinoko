import type { Signal } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, type WritableStateSource } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, exhaustMap, filter, map, of, pipe, switchMap, tap } from 'rxjs';
import type { DataSourcesApi } from '../../../core/api/data-sources.api';
import { finish, type AfterWrite } from '../write';
import { codeOf, followVersion, type UploadStart } from './upload-parts';
import { type ResumeRecord, type UploadEvent, type UploadState } from './upload-machine';

export interface UploadStoreState {
  upload: UploadState;
  /** The open session for a reload. It stays until the upload ends. */
  saved: ResumeRecord | null;
}

/** The parts of the upload store that the end of an upload uses. */
interface EndsHost extends WritableStateSource<UploadStoreState> {
  readonly upload: Signal<UploadState>;
  readonly _api: DataSourcesApi;
  readonly _run: { request: UploadStart | null };
  readonly _apply: (event: UploadEvent) => void;
}

/** The end of an upload: the complete request, the poll of the new version and the discard of an open session. */
export function uploadEnds(store: EndsHost) {
  return {
    /** Drops an open session that this browser cannot continue, so that a new upload can start. */
    discard: rxMethod<{ readonly id: string } & AfterWrite>(
      pipe(
        exhaustMap((request) =>
          store._api.abort(request.id).pipe(
            map(() => true),
            catchError(() => of(false)),
            tap((dropped) => {
              if (dropped) {
                patchState(store, ({ saved }) => ({
                  saved: saved?.uploadId === request.id ? null : saved,
                }));
              }
              finish(request);
            }),
          ),
        ),
      ),
    ),

    _finish: rxMethod<boolean>(
      pipe(
        filter((ready) => ready),
        tap(() => {
          store._apply({ type: 'completing' });
        }),
        exhaustMap(() => {
          const state = store.upload();
          return store._api.complete(state.uploadId ?? '', state.sha256).pipe(
            tapResponse({
              next: (version) => {
                store._run.request = null;
                store._apply({ type: 'completed', version });
              },
              error: (failure: unknown) => {
                store._apply({ type: 'failed', code: codeOf(failure) });
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
          store._apply({ type: 'version', version });
        }),
      ),
    ),
  };
}
