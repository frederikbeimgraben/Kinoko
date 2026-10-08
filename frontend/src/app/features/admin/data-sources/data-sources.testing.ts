import { of, type Observable } from 'rxjs';
import type {
  DataSource,
  DataSourceDetail,
  DataSourceKind,
  DataSourceVersion,
  PipelineRun,
  RemoteSource,
  RemoteSourceId,
} from '../../../core/api/models';

/** A data source of a kind with a state. The other fields have plain values. */
export function sourceOf(kind: DataSourceKind, state: DataSource['state'] = 'ready'): DataSource {
  return {
    kind,
    required: true,
    perSpecies: kind === 'model-bundle',
    usedBy: ['render'],
    state,
    satisfiedBy: null,
    accept: { extensions: ['.parquet'], mediaTypes: [], maxBytes: 2 * 1024 ** 3 },
    activeVersion: null,
    latestVersion: null,
  };
}

/** A remote source with a state. */
export function remoteOf(source: RemoteSourceId, state: RemoteSource['state'] = 'ok'): RemoteSource {
  return {
    source,
    url: `https://example.org/${source}`,
    cadence: 'weekly Mon 03:30',
    state,
    years: [2014, 2026],
    files: 12,
    sizeBytes: 1024 ** 3,
    lastCheckedAt: '2026-10-05T03:30:00Z',
    lastChangedAt: null,
    error: null,
  };
}

/** A version of the trees grid. */
export function versionOf(
  id: string,
  version: number,
  state: DataSourceVersion['state'] = 'ready',
): DataSourceVersion {
  return {
    id,
    kind: 'trees-grid',
    version,
    origin: 'upload',
    derivedFromId: null,
    speciesId: null,
    state,
    active: false,
    fileName: `trees-v${version}.parquet`,
    sizeBytes: 1024 ** 2,
    sha256: 'c0ffee'.repeat(10) + 'abcd',
    metadata: { rows: 2_300_000, crs: 'EPSG:3035' },
    artifacts: [],
    error: null,
    createdBy: { id: 'person-1', name: 'Frederik' },
    createdAt: '2026-10-01T10:00:00Z',
    processedAt: null,
    activatedAt: null,
  };
}

/** A double of the data source API with fixed answers. It records each action. */
export class DataSourcesApiDouble {
  sources: DataSource[] = [sourceOf('trees-grid'), sourceOf('site-grid', 'missing')];
  remoteList: RemoteSource[] = [remoteOf('dwd-hyras'), remoteOf('gbif-occurrences', 'failed')];
  versions: DataSourceVersion[] = [
    { ...versionOf('v-2', 2), active: true },
    versionOf('v-1', 1, 'superseded'),
  ];
  readonly actions: string[] = [];
  readonly details: string[] = [];

  list(): Observable<DataSource[]> {
    return of(this.sources);
  }

  remotes(): Observable<RemoteSource[]> {
    return of(this.remoteList);
  }

  detail(
    kind: DataSourceKind,
    query: { cursor?: string; speciesId?: string } = {},
  ): Observable<DataSourceDetail> {
    this.details.push(query.cursor === undefined ? kind : `${kind}@${query.cursor}`);
    const first = query.cursor === undefined;
    return of({
      ...sourceOf(kind),
      activeVersion: this.versions[0] ?? null,
      versions: first ? this.versions : [versionOf('v-0', 0, 'superseded')],
      nextCursor: first ? 'next' : null,
      openUpload: null,
    });
  }

  activate(_kind: DataSourceKind, id: string): Observable<DataSourceVersion> {
    this.actions.push(`activate:${id}`);
    return of(versionOf(id, 1));
  }

  reprocess(_kind: DataSourceKind, id: string): Observable<DataSourceVersion> {
    this.actions.push(`reprocess:${id}`);
    return of(versionOf(id, 1, 'processing'));
  }

  remove(_kind: DataSourceKind, id: string): Observable<null> {
    this.actions.push(`remove:${id}`);
    return of(null);
  }

  log(): Observable<string[]> {
    return of(['line one', 'line two']);
  }

  refresh(source: RemoteSourceId): Observable<PipelineRun> {
    this.actions.push(`refresh:${source}`);
    return of({ id: 'run-fetch' } as PipelineRun);
  }
}
