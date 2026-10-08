import { TestBed } from '@angular/core/testing';
import { of, throwError, type Observable } from 'rxjs';
import { DataSourcesApi, OffsetMismatch, PartFailure } from '../../../core/api/data-sources.api';
import type { DataSourceVersion, UploadCreate, UploadSession } from '../../../core/api/models';
import { FILE_HASHER } from './hash-file';
import { UploadStore } from './upload.store';

const SHA = 'ab'.repeat(32);
const KEY = 'pilzkarte.datenquellen.upload';

function session(received = 0): UploadSession {
  return {
    id: 'upload-1',
    kind: 'trees-grid',
    speciesId: null,
    fileName: 'trees.parquet',
    sizeBytes: 40,
    receivedBytes: received,
    partSize: 16,
    state: 'open',
    expiresAt: '2026-10-09T10:00:00Z',
    versionId: null,
  };
}

const VERSION = { id: 'version-1', kind: 'trees-grid', version: 2, state: 'ready' } as DataSourceVersion;

/** A double of the API. Each part answers with the new offset, unless `failures` says otherwise. */
class ApiDouble {
  readonly created: UploadCreate[] = [];
  readonly offsets: number[] = [];
  readonly completed: (string | null)[] = [];
  readonly aborted: string[] = [];
  failures: ((offset: number) => Error | null)[] = [];
  open: UploadSession | null = null;

  createUpload(_kind: string, create: UploadCreate): Observable<UploadSession> {
    this.created.push(create);
    return of(session());
  }

  upload(): Observable<UploadSession> {
    return this.open === null ? throwError(() => ({ status: 404 })) : of(this.open);
  }

  append(_id: string, offset: number, part: Blob): Observable<UploadSession> {
    this.offsets.push(offset);
    const failure = this.failures.shift()?.(offset) ?? null;
    return failure === null ? of(session(offset + part.size)) : throwError(() => failure);
  }

  complete(_id: string, sha: string | null): Observable<DataSourceVersion> {
    this.completed.push(sha);
    return of(VERSION);
  }

  abort(id: string): Observable<null> {
    this.aborted.push(id);
    return of(null);
  }
}

function build(api = new ApiDouble()): { store: UploadStore; api: ApiDouble } {
  TestBed.configureTestingModule({
    providers: [
      { provide: DataSourcesApi, useValue: api },
      { provide: FILE_HASHER, useValue: () => of({ done: 20 }, { done: 40 }, { hex: SHA }) },
    ],
  });
  return { store: TestBed.inject(UploadStore), api };
}

const FILE = new File([new Uint8Array(40)], 'trees.parquet', { lastModified: 1_700_000_000_000 });

describe('UploadStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sends each part in order and completes with the hash', () => {
    const { store, api } = build();

    store.start({ kind: 'trees-grid', file: FILE, activate: false });
    TestBed.tick();

    expect(api.created).toEqual([{ fileName: 'trees.parquet', sizeBytes: 40, activate: false }]);
    expect(api.offsets).toEqual([0, 16, 32]);
    expect(api.completed).toEqual([SHA]);
    expect(store.phase()).toBe('done');
    expect(store.upload().version?.id).toBe('version-1');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('continues from the offset of the server after an offset conflict', () => {
    const api = new ApiDouble();
    api.failures = [() => null, () => new OffsetMismatch(32)];
    const { store } = build(api);

    store.start({ kind: 'trees-grid', file: FILE, activate: true });
    TestBed.tick();

    expect(api.offsets).toEqual([0, 16, 32]);
    expect(store.phase()).toBe('done');
  });

  it('tries a part again after a network failure, with a wait', () => {
    vi.useFakeTimers();
    try {
      const api = new ApiDouble();
      api.failures = [() => new PartFailure(503, true)];
      const { store } = build(api);

      store.start({ kind: 'trees-grid', file: FILE, activate: true });
      expect(store.phase()).toBe('retrying');

      vi.advanceTimersByTime(1000);
      TestBed.tick();

      expect(api.offsets).toEqual([0, 0, 16, 32]);
      expect(store.phase()).toBe('done');
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails without a new try when the server refuses the part', () => {
    const api = new ApiDouble();
    api.failures = [() => new PartFailure(413, false)];
    const { store } = build(api);

    store.start({ kind: 'trees-grid', file: FILE, activate: true });

    expect(store.phase()).toBe('failed');
    expect(store.upload().error).toBe('status_413');
    TestBed.tick();
    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toMatchObject({ uploadId: 'upload-1' });
  });

  it('continues the open session of the same file after a reload', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        uploadId: 'upload-1',
        kind: 'trees-grid',
        name: 'trees.parquet',
        size: 40,
        lastModified: 1_700_000_000_000,
      }),
    );
    const api = new ApiDouble();
    api.open = session(32);
    const { store } = build(api);
    expect(store.saved()?.uploadId).toBe('upload-1');

    store.start({ kind: 'trees-grid', file: FILE, activate: true });
    TestBed.tick();

    expect(api.created).toEqual([]);
    expect(api.offsets).toEqual([32]);
    expect(store.phase()).toBe('done');
  });

  it('starts a new session when the stored session is gone', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        uploadId: 'old',
        kind: 'trees-grid',
        name: 'trees.parquet',
        size: 40,
        lastModified: 1_700_000_000_000,
      }),
    );
    const { store, api } = build();

    store.start({ kind: 'trees-grid', file: FILE, activate: true });

    expect(api.created).toHaveLength(1);
    expect(api.offsets[0]).toBe(0);
    expect(store.saved()?.uploadId).toBe('upload-1');
  });

  it('cancels an upload and asks the server to drop the session', () => {
    const api = new ApiDouble();
    api.failures = [() => new PartFailure(500, false)];
    const { store } = build(api);
    store.start({ kind: 'trees-grid', file: FILE, activate: true });

    store.cancel();

    expect(store.phase()).toBe('cancelled');
    expect(api.aborted).toEqual(['upload-1']);
    TestBed.tick();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
