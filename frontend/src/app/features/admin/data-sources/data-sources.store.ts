import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  EMPTY,
  catchError,
  exhaustMap,
  filter,
  forkJoin,
  of,
  pipe,
  switchMap,
  tap,
  type Observable,
} from 'rxjs';
import { DataSourcesApi } from '../../../core/api/data-sources.api';
import {
  RUN_KINDS,
  type DataSource,
  type DataSourceDetail,
  type DataSourceKind,
  type DataSourceVersion,
  type PipelineRun,
  type RemoteSource,
  type RemoteSourceId,
} from '../../../core/api/models';
import { finish, trigger } from '../write';
import {
  followDetail,
  followLog,
  settling,
  versionCall,
  withFirstPage,
  withPage,
  without,
  type DetailQuery,
  type RemoteRefresh,
  type VersionAction,
} from './data-sources.calls';
import { blockedRuns } from './preconditions';

export type { DetailQuery, RemoteRefresh, VersionAction } from './data-sources.calls';

interface DataSourcesState {
  /** `null` while the first response is pending. */
  sources: readonly DataSource[] | null;
  remotes: readonly RemoteSource[] | null;
  kind: DataSourceKind | null;
  speciesId: string | null;
  detail: DataSourceDetail | null;
  log: { readonly versionId: string; readonly lines: readonly string[] } | null;
  /** The id of the version or the remote source with a running action. */
  busy: string | null;
  /** The last fetch run of each remote source that this page started. */
  fetchRuns: Readonly<Partial<Record<RemoteSourceId, string>>>;
}

/** The data sources of the pipeline: the remote caches, the uploaded kinds and their versions. */
export const DataSourcesStore = signalStore(
  { providedIn: 'root' },
  withState<DataSourcesState>({
    sources: null,
    remotes: null,
    kind: null,
    speciesId: null,
    detail: null,
    log: null,
    busy: null,
    fetchRuns: {},
  }),
  withComputed(({ sources, remotes, detail }) => ({
    loaded: computed(() => sources() !== null && remotes() !== null),
    /** The run kinds whose inputs are not ready. Empty until both lists are known. */
    blocked: computed(() => {
      const known = sources();
      const cached = remotes();
      return known === null || cached === null ? [] : blockedRuns(RUN_KINDS, known, cached);
    }),
    settling: computed(() => settling(detail())),
  })),
  withProps(() => ({ _api: inject(DataSourcesApi) })),
  withMethods((store) => {
    const overview = (): Observable<unknown> =>
      forkJoin([
        store._api.list().pipe(catchError(() => of([]))),
        store._api.remotes().pipe(catchError(() => of([]))),
      ]).pipe(
        tap(([sources, remotes]) => {
          patchState(store, { sources, remotes });
        }),
      );

    /** Opens the page of a kind. A new kind or species drops the detail of the page before. */
    const openDetail = rxMethod<DetailQuery | null>(
      pipe(
        filter((query): query is DetailQuery => query !== null),
        tap((query) => {
          const same = store.kind() === query.kind && store.speciesId() === (query.speciesId ?? null);
          patchState(store, {
            kind: query.kind,
            speciesId: query.speciesId ?? null,
            ...(same ? {} : { detail: null, log: null }),
          });
        }),
        switchMap((query) => followDetail(store._api, query)),
        tap((first) => {
          patchState(store, ({ detail }) => ({ detail: withFirstPage(detail, first) }));
        }),
      ),
    );

    const reopen = (): void => {
      const kind = store.kind();
      if (kind !== null) openDetail({ kind, speciesId: store.speciesId() });
    };

    /** Ends an action: clears the busy mark and, after a success, calls the next step. */
    const done = (request: { readonly onDone?: () => void } | null): void => {
      patchState(store, { busy: null });
      if (request !== null) finish(request);
    };

    return {
      openDetail,

      loadOverview: trigger(rxMethod<true>(pipe(switchMap(() => overview())))),

      /** Adds the next page of older versions. */
      more: trigger(
        rxMethod<true>(
          pipe(
            exhaustMap(() => {
              const cursor = store.detail()?.nextCursor ?? null;
              const kind = store.kind();
              const speciesId = store.speciesId();
              if (cursor === null || kind === null) return EMPTY;
              return store._api.detail(kind, { cursor, ...(speciesId ? { speciesId } : {}) }).pipe(
                tapResponse({
                  next: (page) => {
                    patchState(store, ({ detail }) => ({ detail: withPage(detail, page) }));
                  },
                  error: () => undefined,
                }),
              );
            }),
          ),
        ),
      ),

      act: rxMethod<VersionAction>(
        pipe(
          exhaustMap((request) => {
            patchState(store, { busy: request.version.id });
            return versionCall(store._api, request).pipe(
              tapResponse({
                next: () => {
                  if (request.action === 'remove') {
                    patchState(store, ({ detail }) => ({ detail: without(detail, request.version.id) }));
                  }
                  done(request);
                  reopen();
                },
                error: () => {
                  done(null);
                },
              }),
              switchMap(() => overview()),
            );
          }),
        ),
      ),

      /** Shows the log of a version. The log follows the version while it still changes. */
      showLog: rxMethod<DataSourceVersion | null>(
        pipe(
          tap(() => {
            patchState(store, { log: null });
          }),
          switchMap((version) =>
            version === null
              ? EMPTY
              : followLog(
                  store._api,
                  version,
                  () => store.detail()?.versions.find((one) => one.id === version.id) ?? version,
                ).pipe(
                  tap((lines) => {
                    patchState(store, { log: { versionId: version.id, lines } });
                  }),
                ),
          ),
        ),
      ),

      refresh: rxMethod<RemoteRefresh>(
        pipe(
          exhaustMap((request) => {
            patchState(store, { busy: request.source });
            return store._api.refresh(request.source, request.range).pipe(
              tapResponse({
                next: (run: PipelineRun) => {
                  patchState(store, ({ fetchRuns }) => ({
                    fetchRuns: { ...fetchRuns, [request.source]: run.id },
                  }));
                  done(request);
                },
                error: () => {
                  done(null);
                },
              }),
              switchMap(() => overview()),
            );
          }),
        ),
      ),
    };
  }),
);

/** The instance type of {@link DataSourcesStore}. */
export type DataSourcesStore = InstanceType<typeof DataSourcesStore>;
