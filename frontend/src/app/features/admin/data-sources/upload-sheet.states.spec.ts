import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NEVER, of, throwError, type Observable } from 'rxjs';
import { DataSourcesApi } from '../../../core/api/data-sources.api';
import type { DataSourceVersion, UploadCreate, UploadSession } from '../../../core/api/models';
import { ANY_ROUTE } from '../../../testing/routes';
import { DataSourcesStore } from './data-sources.store';
import { DataSourcesApiDouble, sourceOf } from './data-sources.testing';
import { FILE_HASHER } from './hash-file';
import { UploadSheetComponent } from './upload-sheet.component';

const KEY = 'pilzkarte.datenquellen.upload';
const DROP = /Datei hierher ziehen/;

/** A double whose answers each test sets. A part never lands, so the upload stays in its phase. */
class SheetApiDouble extends DataSourcesApiDouble {
  readonly created: UploadCreate[] = [];
  readonly aborted: string[] = [];
  readonly opened: string[] = [];
  createAnswer: () => Observable<UploadSession> = () => of(this.session());
  appendAnswer: () => Observable<UploadSession> = () => NEVER;
  completeAnswer: () => Observable<DataSourceVersion> = () => NEVER;

  createUpload(_kind: string, create: UploadCreate): Observable<UploadSession> {
    this.created.push(create);
    return this.createAnswer();
  }

  upload(id: string): Observable<UploadSession> {
    this.opened.push(id);
    return of(this.session('upload-old'));
  }

  append(): Observable<UploadSession> {
    return this.appendAnswer();
  }

  complete(): Observable<DataSourceVersion> {
    return this.completeAnswer();
  }

  abort(id: string): Observable<null> {
    this.aborted.push(id);
    return of(null);
  }

  session(id = 'upload-9', received = 0): UploadSession {
    return {
      id,
      kind: 'trees-grid',
      speciesId: null,
      fileName: 'trees.parquet',
      sizeBytes: 10,
      receivedBytes: received,
      partSize: 4,
      state: 'open',
      expiresAt: '2026-10-09T10:00:00Z',
      versionId: null,
    };
  }
}

async function build(api = new SheetApiDouble(), overview = true) {
  const view = await render(UploadSheetComponent, {
    inputs: { kind: 'trees-grid' },
    providers: [
      provideRouter(ANY_ROUTE),
      { provide: DataSourcesApi, useValue: api },
      { provide: FILE_HASHER, useValue: () => NEVER },
    ],
  });
  if (overview) TestBed.inject(DataSourcesStore).loadOverview();
  view.detectChanges();
  return { api, view };
}

const listOf = (...files: File[]) => ({ length: files.length, item: (at: number) => files.at(at) ?? null });

const trees = (): File => new File([new Uint8Array(10)], 'trees.parquet', { lastModified: 5 });

describe('UploadSheetComponent states', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('refuses a file over the size limit', async () => {
    const api = new SheetApiDouble();
    api.sources = [{ ...sourceOf('trees-grid'), accept: { extensions: [], mediaTypes: [], maxBytes: 4 } }];
    await build(api);

    await userEvent.upload(screen.getByLabelText(DROP), trees());

    expect(screen.getByRole('alert')).toHaveTextContent('Die Datei ist größer als');
    expect(screen.queryByRole('button', { name: 'Hochladen' })).not.toBeInTheDocument();
  });

  it('takes a dropped file and sends the switch value', async () => {
    const { api } = await build();

    fireEvent.drop(screen.getByLabelText(DROP), { dataTransfer: { files: listOf(trees()) } });
    await userEvent.click(await screen.findByRole('switch', { name: 'Aktivieren, sobald bereit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hochladen' }));

    expect(api.created).toEqual([{ fileName: 'trees.parquet', sizeBytes: 10, activate: false }]);
    expect(screen.getByText('trees.parquet')).toBeInTheDocument();
  });

  it('ignores a drop without a file', async () => {
    await build();

    fireEvent.drop(screen.getByLabelText(DROP), { dataTransfer: { files: listOf() } });

    expect(screen.queryByRole('button', { name: 'Hochladen' })).not.toBeInTheDocument();
  });

  it('pauses, resumes and cancels a running upload', async () => {
    const { api } = await build();
    await userEvent.upload(screen.getByLabelText(DROP), trees());
    await userEvent.click(screen.getByRole('button', { name: 'Hochladen' }));

    await userEvent.click(screen.getByRole('button', { name: 'Pausieren' }));
    expect(screen.getByText('Pausiert')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Fortsetzen' }));
    expect(screen.getByRole('button', { name: 'Pausieren' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(api.aborted).toEqual(['upload-9']);
    expect(screen.getByLabelText(DROP)).toBeInTheDocument();
  });

  it('shows a failure and starts again on request', async () => {
    const api = new SheetApiDouble();
    api.createAnswer = () => throwError(() => ({ code: 'disk_full' }));
    await build(api);
    await userEvent.upload(screen.getByLabelText(DROP), trees());
    await userEvent.click(screen.getByRole('button', { name: 'Hochladen' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Auf dem Server ist nicht genug Platz.');

    api.createAnswer = () => of(api.session());
    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(api.created).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Pausieren' })).toBeInTheDocument();
  });

  it('cancels a failed upload and shows the file choice again', async () => {
    const api = new SheetApiDouble();
    api.createAnswer = () => throwError(() => ({ code: 'odd' }));
    await build(api);
    await userEvent.upload(screen.getByLabelText(DROP), trees());
    await userEvent.click(screen.getByRole('button', { name: 'Hochladen' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Das Hochladen ist fehlgeschlagen.');

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(api.aborted).toEqual([]);
    expect(screen.getByLabelText(DROP)).toBeInTheDocument();
  });

  it('asks for the same file after a reload and continues its session', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ uploadId: 'upload-old', kind: 'trees-grid', name: 'trees.parquet', size: 10, lastModified: 5 }),
    );
    const { api } = await build();

    expect(screen.getByText('Wähle trees.parquet noch einmal, um fortzusetzen.')).toBeInTheDocument();

    await userEvent.upload(screen.getByLabelText(DROP), trees());
    await userEvent.click(screen.getByRole('button', { name: 'Fortsetzen' }));

    expect(api.opened).toEqual(['upload-old']);
    expect(api.created).toEqual([]);
  });

  it('takes the accepted format from the detail when the list does not have the kind', async () => {
    const api = new SheetApiDouble();
    api.sources = [];
    await build(api, false);
    expect(screen.queryByText(/Erlaubt:/)).not.toBeInTheDocument();

    TestBed.inject(DataSourcesStore).openDetail({ kind: 'trees-grid' });
    TestBed.tick();

    expect(await screen.findByText(/Erlaubt: \.parquet/)).toBeInTheDocument();
  });

  it('opens the new version and closes the sheet', async () => {
    const api = new SheetApiDouble();
    api.appendAnswer = () => of(api.session('upload-9', 10));
    api.completeAnswer = () =>
      of({ id: 'version-9', kind: 'trees-grid', version: 9, state: 'ready' } as DataSourceVersion);
    const hashed = { provide: FILE_HASHER, useValue: () => of({ hex: 'cd'.repeat(32) }) };
    const closed = vi.fn();
    await render(UploadSheetComponent, {
      inputs: { kind: 'trees-grid' },
      on: { closed },
      providers: [provideRouter(ANY_ROUTE), { provide: DataSourcesApi, useValue: api }, hashed],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await userEvent.upload(screen.getByLabelText(DROP), trees());
    await userEvent.click(screen.getByRole('button', { name: 'Hochladen' }));
    TestBed.tick();

    await userEvent.click(await screen.findByRole('button', { name: /Zur Version/ }));

    expect(closed).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/verwaltung/datenquellen', 'trees-grid']);
  });
});
