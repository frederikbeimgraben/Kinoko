import { TestBed } from '@angular/core/testing';
import { DataSourcesApi } from '../../../core/api/data-sources.api';
import { DataSourcesApiDouble } from './data-sources.testing';
import { DataSourcesStore } from './data-sources.store';

function build(api = new DataSourcesApiDouble()): { store: DataSourcesStore; api: DataSourcesApiDouble } {
  TestBed.configureTestingModule({ providers: [{ provide: DataSourcesApi, useValue: api }] });
  return { store: TestBed.inject(DataSourcesStore), api };
}

describe('DataSourcesStore', () => {
  it('loads both lists and names the blocked run kinds', () => {
    const { store } = build();
    expect(store.loaded()).toBe(false);

    store.loadOverview();

    expect(store.loaded()).toBe(true);
    expect(store.blocked().map((entry) => entry.run)).toEqual(['training', 'render', 'full']);
  });

  it('opens a detail and adds the next page of versions', () => {
    const { store, api } = build();

    store.openDetail({ kind: 'trees-grid' });
    expect(store.detail()?.versions.map((one) => one.id)).toEqual(['v-2', 'v-1']);

    store.more();

    expect(api.details).toEqual(['trees-grid', 'trees-grid@next']);
    expect(store.detail()?.versions.map((one) => one.id)).toEqual(['v-2', 'v-1', 'v-0']);
    expect(store.detail()?.nextCursor).toBeNull();
  });

  it('runs an action on a version, then reads the detail again', () => {
    const { store, api } = build();
    const onDone = vi.fn();
    store.openDetail({ kind: 'trees-grid' });
    const version = store.detail()?.versions[1];
    if (version === undefined) throw new Error('no version');

    store.act({ version, action: 'activate', onDone });

    expect(api.actions).toEqual(['activate:v-1']);
    expect(onDone).toHaveBeenCalledOnce();
    expect(api.details).toEqual(['trees-grid', 'trees-grid']);
    expect(store.busy()).toBeNull();
  });

  it('keeps the fetch run of a refresh for the link to the run', () => {
    const { store, api } = build();

    store.refresh({ source: 'dwd-hyras', range: { fromYear: 2020 } });

    expect(api.actions).toEqual(['refresh:dwd-hyras']);
    expect(store.fetchRuns()['dwd-hyras']).toBe('run-fetch');
  });

  it('shows the log of a version and drops it on close', () => {
    const { store } = build();
    store.openDetail({ kind: 'trees-grid' });
    const version = store.detail()?.versions[0] ?? null;

    store.showLog(version);
    expect(store.log()?.lines).toEqual(['line one', 'line two']);

    store.showLog(null);
    expect(store.log()).toBeNull();
  });
});
