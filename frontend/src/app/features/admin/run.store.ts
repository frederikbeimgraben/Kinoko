import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { filter, pipe, switchMap, tap } from 'rxjs';
import { RunsApi } from '../../core/api/runs.api';
import type { PipelineRunDetail } from '../../core/api/models';
import { setFailed, setLoaded, setLoading, withLoadState } from '../../core/state';

interface RunState {
  id: string;
  run: PipelineRunDetail | null;
}

/** One run with its steps, its inputs and its output. */
export const RunStore = signalStore(
  { providedIn: 'root' },
  withState<RunState>({ id: '', run: null }),
  withLoadState(),
  withProps(() => ({ _api: inject(RunsApi) })),
  withMethods((store) => ({
    /** Loads a run. A second call for the same run has no effect. */
    load: rxMethod<string>(
      pipe(
        filter((id) => id !== store.id()),
        tap((id) => {
          patchState(store, { id, run: null }, setLoading());
        }),
        filter((id) => id !== ''),
        switchMap((id) =>
          store._api.get(id).pipe(
            tapResponse({
              next: (run) => {
                patchState(store, { run }, setLoaded());
              },
              error: () => {
                patchState(store, setFailed());
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
