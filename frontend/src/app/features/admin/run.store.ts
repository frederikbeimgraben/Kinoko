import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { filter, pipe, switchMap, tap } from 'rxjs';
import { RunsApi } from '../../core/api/runs.api';
import type { PipelineRunDetail } from '../../core/api/models';
import { isProblemDetail } from '../../core/api/problem';
import { setFailed, setLoaded, setLoading, withLoadState } from '../../core/state';

interface RunState {
  id: string;
  run: PipelineRunDetail | null;
  /** True when the server does not know the run. Other errors only set the failed state. */
  missing: boolean;
}

/** One run with its steps, its inputs and its output. */
export const RunStore = signalStore(
  { providedIn: 'root' },
  withState<RunState>({ id: '', run: null, missing: false }),
  withLoadState(),
  withProps(() => ({ _api: inject(RunsApi) })),
  withMethods((store) => ({
    /** Loads a run. A second call for the same run gets it again and shows the old data until then. */
    load: rxMethod<string>(
      pipe(
        tap((id) => {
          patchState(
            store,
            ({ id: before, run }) => ({ id, run: id === before ? run : null, missing: false }),
            setLoading(),
          );
        }),
        filter((id) => id !== ''),
        switchMap((id) =>
          store._api.get(id).pipe(
            tapResponse({
              next: (run) => {
                patchState(store, { run }, setLoaded());
              },
              error: (problem: unknown) => {
                patchState(
                  store,
                  { missing: isProblemDetail(problem) && problem.status === 404 },
                  setFailed(),
                );
              },
            }),
          ),
        ),
      ),
    ),
  })),
);

/** The instance type of {@link RunStore}. */
export type RunStore = InstanceType<typeof RunStore>;
