import type { DataSource, DataSourceKind, RemoteSource, RemoteSourceId } from '../../../core/api/models';
import { RUN_NEEDS, blockedRuns, missingNeeds } from './preconditions';

function source(kind: DataSourceKind, state: DataSource['state'] = 'ready'): DataSource {
  return {
    kind,
    required: true,
    perSpecies: kind === 'model-bundle',
    usedBy: ['render'],
    state,
    satisfiedBy: null,
    accept: { extensions: ['.zip'], mediaTypes: [], maxBytes: 1 },
    activeVersion: null,
    latestVersion: null,
  };
}

function remote(id: RemoteSourceId, state: RemoteSource['state'] = 'ok'): RemoteSource {
  return {
    source: id,
    url: 'https://example.org',
    cadence: 'weekly',
    state,
    years: [],
    files: 0,
    sizeBytes: 0,
    lastCheckedAt: null,
    lastChangedAt: null,
    error: null,
  };
}

const ALL_UPLOADS: DataSource[] = (['trees-grid', 'tree-scales', 'site-grid', 'model-bundle'] as const).map(
  (kind) => source(kind),
);
const ALL_REMOTES: RemoteSource[] = (['dwd-hyras', 'dwd-soil-moisture', 'gbif-occurrences'] as const).map(
  (id) => remote(id),
);

describe('run preconditions', () => {
  it('lets each run start when every input is ready', () => {
    expect(blockedRuns(['training', 'render', 'full', 'fetch'], ALL_UPLOADS, ALL_REMOTES)).toEqual([]);
  });

  it('never blocks a fetch run', () => {
    expect(missingNeeds('fetch', [], [])).toEqual([]);
  });

  it('names a missing upload of the render run', () => {
    const sources = ALL_UPLOADS.map((one) =>
      one.kind === 'site-grid' ? source('site-grid', 'missing') : one,
    );

    const missing = missingNeeds('render', sources, ALL_REMOTES);

    expect(missing).toEqual([[[{ upload: 'site-grid' }]]]);
    expect(missingNeeds('training', sources, ALL_REMOTES)).toEqual([]);
  });

  it('takes the weather checkpoints instead of the DWD sources', () => {
    const remotes = [remote('dwd-hyras', 'bootstrapping'), remote('gbif-occurrences')];

    expect(missingNeeds('render', ALL_UPLOADS, remotes)).toHaveLength(1);
    expect(missingNeeds('render', [...ALL_UPLOADS, source('weather-checkpoints')], remotes)).toEqual([]);
  });

  it('counts a stale cache as complete and a failed cache as missing', () => {
    const stale = ALL_REMOTES.map((one) => remote(one.source, 'stale'));
    const failed = ALL_REMOTES.map((one) => remote(one.source, 'failed'));

    expect(missingNeeds('training', ALL_UPLOADS, stale)).toEqual([]);
    expect(missingNeeds('training', ALL_UPLOADS, failed)).toHaveLength(2);
  });

  it('gives the full run each need of training and render once', () => {
    const keys = RUN_NEEDS.full.map((need) => JSON.stringify(need));

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(6);
  });
});
