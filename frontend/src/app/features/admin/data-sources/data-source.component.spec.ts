import { signal, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NEVER, of, type Observable } from 'rxjs';
import { DataSourcesApi } from '../../../core/api/data-sources.api';
import type {
  DataSourceDetail,
  DataSourceKind,
  DataSourceVersion,
  UploadSession,
} from '../../../core/api/models';
import { ANY_ROUTE } from '../../../testing/routes';
import { SpeciesStore } from '../../species/species.store';
import { DataSourceComponent } from './data-source.component';
import { DataSourcesApiDouble, sourceOf, versionOf } from './data-sources.testing';
import { FILE_HASHER } from './hash-file';
import { UploadStore } from './upload.store';

const SPECIES = [
  { id: 'boletus', name: 'Steinpilz' },
  { id: 'amanita', name: 'Fliegenpilz' },
];

/** A double whose detail each test sets. It records each species filter. */
class DetailApiDouble extends DataSourcesApiDouble {
  readonly filters: (string | undefined)[] = [];
  page: Partial<DataSourceDetail> = {};

  override detail(
    kind: DataSourceKind,
    query: { cursor?: string; speciesId?: string } = {},
  ): Observable<DataSourceDetail> {
    this.filters.push(query.speciesId);
    return of({
      ...sourceOf(kind),
      activeVersion: null,
      versions: [],
      nextCursor: null,
      openUpload: null,
      ...this.page,
    });
  }

  createUpload(): Observable<never> {
    return NEVER;
  }
}

async function build(
  kind: string,
  api: DataSourcesApiDouble = new DetailApiDouble(),
  extra: Provider[] = [],
) {
  const map = convertToParamMap({ kind });
  await render(DataSourceComponent, {
    providers: [
      ...extra,
      provideRouter(ANY_ROUTE),
      { provide: DataSourcesApi, useValue: api },
      { provide: SpeciesStore, useValue: { loadBundle: () => Promise.resolve(), species: signal(SPECIES) } },
      { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } },
    ],
  });
  TestBed.tick();
}

const bundleVersion = (id: string, speciesId: string, version: number): DataSourceVersion => ({
  ...versionOf(id, version),
  kind: 'model-bundle',
  speciesId,
  active: true,
  artifacts: [],
});

describe('DataSourceComponent states', () => {
  it('says that an unknown kind does not exist', async () => {
    await build('nonsense');

    expect(screen.getByRole('heading', { name: 'Datenquellen' })).toBeInTheDocument();
    expect(screen.getByText('Datenquelle nicht gefunden')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hochladen' })).not.toBeInTheDocument();
  });

  it('shows skeletons while the detail loads', async () => {
    const api = new DetailApiDouble();
    api.detail = () => NEVER;
    await build('dem', api);

    expect(screen.getByRole('heading', { name: 'Höhenmodell' })).toBeInTheDocument();
    expect(screen.queryByText('Format')).not.toBeInTheDocument();
  });

  it('offers an upload when no version exists', async () => {
    await build('dem');

    expect(screen.getByText('Noch keine Version')).toBeInTheDocument();
    expect(screen.queryByText('Aktive Version')).not.toBeInTheDocument();

    const empty = screen.getByText('Noch keine Version').closest<HTMLElement>('app-state-view');
    await userEvent.click(within(empty ?? document.body).getByRole('button', { name: 'Hochladen' }));

    expect(screen.getByRole('dialog', { name: 'Höhenmodell hochladen' })).toBeInTheDocument();
  });

  it('shows an interrupted upload and the artifacts of the active version', async () => {
    const api = new DetailApiDouble();
    const active = {
      ...versionOf('v-5', 5),
      active: true,
      artifacts: [{ name: 'tiles.pmtiles', sizeBytes: 2048 }],
    } as DataSourceVersion;
    api.page = {
      activeVersion: active,
      versions: [active],
      openUpload: { fileName: 'big.parquet' } as DataSourceDetail['openUpload'],
    };
    await build('trees-grid', api);

    expect(screen.getByText('Hochladen unterbrochen: big.parquet')).toBeInTheDocument();
    expect(screen.getByText('tiles.pmtiles')).toBeInTheDocument();
    expect(screen.getByText('Artefakte')).toBeInTheDocument();
  });

  it('reads the detail again when an upload of this kind ends', async () => {
    const api = new DetailApiDouble();
    const open = { id: 'upload-3', receivedBytes: 4, partSize: 4, state: 'open' } as UploadSession;
    Object.assign(api, {
      createUpload: () => of({ ...open, receivedBytes: 0 }),
      append: () => of(open),
      complete: () => of(versionOf('v-9', 9, 'validating')),
    });
    const hashed = { provide: FILE_HASHER, useValue: () => of({ hex: 'ab'.repeat(32) }) };
    await build('trees-grid', api, [hashed]);
    expect(api.filters).toHaveLength(1);

    const file = new File([new Uint8Array(4)], 'trees.parquet', { lastModified: 1 });
    TestBed.inject(UploadStore).start({ kind: 'trees-grid', file, activate: true });
    TestBed.tick();

    expect(TestBed.inject(UploadStore).phase()).toBe('done');
    expect(api.filters).toHaveLength(2);
  });

  it('goes back to the list of data sources', async () => {
    await build('dem');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(navigate).toHaveBeenCalledWith('/verwaltung/datenquellen');
  });
});

describe('DataSourceComponent per species', () => {
  function bundleApi(): DetailApiDouble {
    const api = new DetailApiDouble();
    api.page = {
      ...sourceOf('model-bundle'),
      versions: [bundleVersion('m-1', 'boletus', 3), bundleVersion('m-2', 'amanita', 1)],
    };
    return api;
  }

  it('lists the active version of each species by name', async () => {
    await build('model-bundle', bundleApi());

    expect(screen.getByText('Arten')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Art.*Alle Arten/ })).toBeInTheDocument();
    const names = screen.getAllByRole('button', { name: /pilz/ }).map((one) => one.textContent);
    expect(names[0]).toContain('Fliegenpilz');
    expect(names[1]).toContain('Steinpilz');
  });

  it('opens the history of one species from its row', async () => {
    const api = bundleApi();
    await build('model-bundle', api);

    await userEvent.click(screen.getByRole('button', { name: /Steinpilz/ }));

    expect(api.filters).toContain('boletus');
    expect(screen.getByRole('button', { name: /Art.*Steinpilz/ })).toBeInTheDocument();
  });

  it('picks a species and all species again in the option sheet', async () => {
    const api = bundleApi();
    await build('model-bundle', api);

    await userEvent.click(screen.getByRole('button', { name: /Art.*Alle Arten/ }));
    await userEvent.click(within(screen.getByRole('dialog')).getByText('Fliegenpilz'));
    expect(api.filters.at(-1)).toBe('amanita');

    await userEvent.click(screen.getByRole('button', { name: /Art.*Fliegenpilz/ }));
    await userEvent.click(within(screen.getByRole('dialog')).getByText('Alle Arten'));
    expect(api.filters.at(-1)).toBeUndefined();
  });
});
