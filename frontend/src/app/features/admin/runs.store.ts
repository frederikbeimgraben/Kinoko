import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap, pipe, switchMap } from 'rxjs';
import { RunsApi } from '../../core/api/runs.api';
import type { PipelineRun, RunKind } from '../../core/api/models';
import { type AfterWrite, finish, trigger } from './write';

interface RunsState {
  /** `null` while the first response is pending. */
  runs: readonly PipelineRun[] | null;
  starting: boolean;
}

/** A request to start a run of this kind. */
export interface RunStart extends AfterWrite {
  readonly kind: RunKind;
}

/** The list of runs. A new run is at the top at once. */
export const RunsStore = signalStore(
  { providedIn: 'root' },
  withState<RunsState>({ runs: null, starting: false }),
  withProps(() => ({ _api: inject(RunsApi) })),
  withMethods((store) => ({
    load: trigger(
      rxMethod<true>(
        pipe(
          switchMap(() =>
            store._api.list().pipe(
              tapResponse({
                next: (runs) => {
                  patchState(store, { runs });
                },
                error: () => {
                  patchState(store, ({ runs }) => ({ runs: runs ?? [] }));
                },
              }),
            ),
          ),
        ),
      ),
    ),

    /** Puts a run that started somewhere else, for example a fetch of a remote source, at the top. */
    add(run: PipelineRun): void {
      patchState(store, ({ runs }) => ({ runs: [run, ...(runs ?? []).filter((one) => one.id !== run.id)] }));
    },

    start: rxMethod<RunStart>(
      pipe(
        exhaustMap((request) => {
          patchState(store, { starting: true });
          return store._api.create(request.kind).pipe(
            tapResponse({
              next: (run) => {
                patchState(store, ({ runs }) => ({ runs: [run, ...(runs ?? [])], starting: false }));
                finish(request);
              },
              error: () => {
                patchState(store, { starting: false });
              },
            }),
          );
        }),
      ),
    ),
  })),
);

/** The instance type of {@link RunsStore}. */
export type RunsStore = InstanceType<typeof RunsStore>;
