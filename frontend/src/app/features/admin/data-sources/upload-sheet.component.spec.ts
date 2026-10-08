import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, type Observable } from 'rxjs';
import { DataSourcesApi } from '../../../core/api/data-sources.api';
import type { DataSourceVersion, UploadSession } from '../../../core/api/models';
import { noViolations } from '../../../testing/axe';
import { ANY_ROUTE } from '../../../testing/routes';
import { DataSourcesStore } from './data-sources.store';
import { DataSourcesApiDouble } from './data-sources.testing';
import { FILE_HASHER } from './hash-file';
import { UploadSheetComponent } from './upload-sheet.component';

/** The data source double with the upload calls of one small session. */
class UploadApiDouble extends DataSourcesApiDouble {
  readonly offsets: number[] = [];

  createUpload(): Observable<UploadSession> {
    return of(this.session(0));
  }

  append(_id: string, offset: number, part: Blob): Observable<UploadSession> {
    this.offsets.push(offset);
    return of(this.session(offset + part.size));
  }

  complete(): Observable<DataSourceVersion> {
    return of({ id: 'version-9', kind: 'trees-grid', version: 9, state: 'ready' } as DataSourceVersion);
  }

  private session(received: number): UploadSession {
    return {
      id: 'upload-9',
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

async function build(): Promise<{ container: Element; api: UploadApiDouble }> {
  localStorage.clear();
  const api = new UploadApiDouble();
  const { container } = await render(UploadSheetComponent, {
    inputs: { kind: 'trees-grid' },
    providers: [
      provideRouter(ANY_ROUTE),
      { provide: DataSourcesApi, useValue: api },
      { provide: FILE_HASHER, useValue: () => of({ hex: 'cd'.repeat(32) }) },
    ],
  });
  TestBed.inject(DataSourcesStore).loadOverview();
  return { container, api };
}

describe('UploadSheetComponent', () => {
  it('names the accepted format and refuses a wrong file type', async () => {
    const { container } = await build();

    expect(await screen.findByText(/Erlaubt: \.parquet/)).toBeInTheDocument();

    await userEvent.upload(screen.getByLabelText(/Datei hierher ziehen/), new File(['x'], 'map.png'), {
      applyAccept: false,
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Dieser Dateityp passt nicht.');
    expect(screen.queryByRole('button', { name: 'Hochladen' })).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('uploads a file in parts and links to the new version', async () => {
    const { api } = await build();

    await userEvent.upload(
      screen.getByLabelText(/Datei hierher ziehen/),
      new File([new Uint8Array(10)], 'trees.parquet'),
    );
    expect(screen.getByRole('switch', { name: 'Aktivieren, sobald bereit' })).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Hochladen' }));
    TestBed.tick();

    expect(api.offsets).toEqual([0, 4, 8]);
    expect(await screen.findByRole('button', { name: /Zur Version/ })).toBeInTheDocument();
  });
});
