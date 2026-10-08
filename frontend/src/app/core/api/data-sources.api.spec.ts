import { HttpErrorResponse, HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DataSourcesApi, OffsetMismatch, PartFailure, partError } from './data-sources.api';

function build(): { api: DataSourcesApi; http: HttpTestingController } {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(DataSourcesApi), http: TestBed.inject(HttpTestingController) };
}

const failure = (status: number, headers: Record<string, string> = {}): HttpErrorResponse =>
  new HttpErrorResponse({ status, headers: new HttpHeaders(headers) });

describe('DataSourcesApi', () => {
  it('reads the lists and a page of the version history', () => {
    const { api, http } = build();
    const got: unknown[] = [];

    api.list().subscribe((items) => got.push(items));
    http.expectOne('/api/data-sources').flush({ items: ['a'] });
    api.remotes().subscribe((items) => got.push(items));
    http.expectOne('/api/remote-sources').flush({ items: ['b'] });
    api.detail('dem').subscribe();
    http.expectOne('/api/data-sources/dem').flush({});
    api.detail('model-bundle', { cursor: 'c2', speciesId: 'boletus' }).subscribe();
    const page = http.expectOne((request) => request.url === '/api/data-sources/model-bundle');
    page.flush({});

    expect(got).toEqual([['a'], ['b']]);
    expect(page.request.params.get('cursor')).toBe('c2');
    expect(page.request.params.get('speciesId')).toBe('boletus');
    http.verify();
  });

  it('encodes the version id in the version actions', () => {
    const { api, http } = build();

    api.version('dem', 'v/1').subscribe();
    http.expectOne('/api/data-sources/dem/versions/v%2F1').flush({});
    api.activate('dem', 'v1').subscribe();
    expect(http.expectOne('/api/data-sources/dem/versions/v1/activate').request.method).toBe('POST');
    api.reprocess('dem', 'v1').subscribe();
    expect(http.expectOne('/api/data-sources/dem/versions/v1/reprocess').request.method).toBe('POST');
    api.remove('dem', 'v1').subscribe();
    expect(http.expectOne('/api/data-sources/dem/versions/v1').request.method).toBe('DELETE');
    http.verify();
  });

  it('reads the log with a default tail and gives an empty list without lines', () => {
    const { api, http } = build();
    const logs: string[][] = [];

    api.log('dem', 'v1').subscribe((lines) => logs.push(lines));
    const first = http.expectOne((request) => request.url === '/api/data-sources/dem/versions/v1/log');
    expect(first.request.params.get('tail')).toBe('200');
    first.flush({ lines: ['one'] });
    api.log('dem', 'v1', 5).subscribe((lines) => logs.push(lines));
    http.expectOne((request) => request.url.endsWith('/log')).flush({});

    expect(logs).toEqual([['one'], []]);
  });

  it('refreshes a remote source with an empty range or a given range', () => {
    const { api, http } = build();

    api.refresh('dwd-hyras').subscribe();
    expect(http.expectOne('/api/remote-sources/dwd-hyras/refresh').request.body).toEqual({});
    api.refresh('dwd-hyras', { fromYear: 2020 }).subscribe();
    expect(http.expectOne('/api/remote-sources/dwd-hyras/refresh').request.body).toEqual({ fromYear: 2020 });
  });

  it('creates, reads, completes and aborts an upload', () => {
    const { api, http } = build();

    const create = { fileName: 'a.tif', sizeBytes: 10, activate: true };
    api.createUpload('dem', create).subscribe();
    expect(http.expectOne('/api/data-sources/dem/uploads').request.body).toEqual(create);
    api.upload('u 1').subscribe();
    http.expectOne('/api/data-source-uploads/u%201').flush({});
    api.complete('u1', null).subscribe();
    expect(http.expectOne('/api/data-source-uploads/u1/complete').request.body).toEqual({});
    api.complete('u1', 'ab').subscribe();
    expect(http.expectOne('/api/data-source-uploads/u1/complete').request.body).toEqual({ sha256: 'ab' });
    api.abort('u1').subscribe();
    expect(http.expectOne('/api/data-source-uploads/u1').request.method).toBe('DELETE');
  });

  it('sends a part with its offset and turns a conflict into an offset mismatch', () => {
    const { api, http } = build();
    const errors: unknown[] = [];

    api.append('u1', 16, new Blob(['x'])).subscribe({ error: (error: unknown) => errors.push(error) });
    const part = http.expectOne('/api/data-source-uploads/u1');
    expect(part.request.method).toBe('PATCH');
    expect(part.request.headers.get('Upload-Offset')).toBe('16');
    part.flush(null, { status: 409, statusText: 'Conflict', headers: { 'Upload-Offset': '32' } });

    expect(errors[0]).toBeInstanceOf(OffsetMismatch);
    expect((errors[0] as OffsetMismatch).offset).toBe(32);
  });
});

describe('partError', () => {
  it('allows a new try after a network gap, a time-out, a rate limit or a server error', () => {
    for (const status of [0, 408, 429, 500, 503]) {
      const error = partError(failure(status));
      expect(error).toBeInstanceOf(PartFailure);
      expect((error as PartFailure).retry).toBe(true);
    }
  });

  it('allows no new try after a client error or a conflict without a valid offset', () => {
    for (const error of [
      partError(failure(400)),
      partError(failure(409)),
      partError(failure(409, { 'Upload-Offset': 'many' })),
    ]) {
      expect(error).toBeInstanceOf(PartFailure);
      expect((error as PartFailure).retry).toBe(false);
    }
  });

  it('allows a new try after an error that is not an HTTP answer', () => {
    const error = partError(new Error('gone'));

    expect(error).toEqual(new PartFailure(0, true));
    expect((error as PartFailure).status).toBe(0);
  });
});
