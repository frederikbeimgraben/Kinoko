import type { DataSourceVersion, UploadSession } from '../../../core/api/models';
import {
  INITIAL_UPLOAD,
  asResumeRecord,
  backoffMs,
  etaSeconds,
  nextPart,
  percentSent,
  readyToComplete,
  reduce,
  resumeRecord,
  sameFile,
  throughput,
  type UploadEvent,
  type UploadState,
} from './upload-machine';

const FILE = { name: 'trees.parquet', size: 40, lastModified: 1_700_000_000_000 };

function session(received = 0): UploadSession {
  return {
    id: 'upload-1',
    kind: 'trees-grid',
    speciesId: null,
    fileName: FILE.name,
    sizeBytes: FILE.size,
    receivedBytes: received,
    partSize: 16,
    state: 'open',
    expiresAt: '2026-10-09T10:00:00Z',
    versionId: null,
  };
}

const VERSION = { id: 'version-1', kind: 'trees-grid', version: 3, state: 'validating' } as DataSourceVersion;

const run = (events: readonly UploadEvent[], from: UploadState = INITIAL_UPLOAD): UploadState =>
  events.reduce(reduce, from);

const started = run([
  { type: 'start', kind: 'trees-grid', file: FILE, activate: true },
  { type: 'created', session: session(), at: 0 },
]);

describe('upload state machine', () => {
  it('starts, creates a session and sends the parts in order', () => {
    expect(started.phase).toBe('sending');
    expect(nextPart(started)).toEqual({ start: 0, end: 16 });

    const second = reduce(started, { type: 'sent', received: 16, at: 1000 });
    expect(nextPart(second)).toEqual({ start: 16, end: 32 });

    const last = reduce(second, { type: 'sent', received: 32, at: 2000 });
    expect(nextPart(last)).toEqual({ start: 32, end: 40 });

    expect(nextPart(reduce(last, { type: 'sent', received: 40, at: 3000 }))).toBeNull();
  });

  it('continues from the offset of an existing session', () => {
    const resumed = run([
      { type: 'start', kind: 'trees-grid', file: FILE, activate: true },
      { type: 'created', session: session(32), at: 0 },
    ]);

    expect(nextPart(resumed)).toEqual({ start: 32, end: 40 });
    expect(percentSent(resumed)).toBe(80);
  });

  it('completes only when each byte is sent and the hash is known', () => {
    const sent = reduce(started, { type: 'sent', received: 40, at: 1000 });
    expect(readyToComplete(sent)).toBe(false);
    expect(reduce(sent, { type: 'completing' }).phase).toBe('sending');

    const hashed = reduce(sent, { type: 'digest', hex: 'ab'.repeat(32) });
    expect(readyToComplete(hashed)).toBe(true);

    const done = run([{ type: 'completing' }, { type: 'completed', version: VERSION }], hashed);
    expect(done.phase).toBe('done');
    expect(done.version?.id).toBe('version-1');
  });

  it('pauses after the running part and resumes', () => {
    const paused = reduce(started, { type: 'pause' });
    expect(paused.phase).toBe('paused');

    const partLanded = reduce(paused, { type: 'sent', received: 16, at: 500 });
    expect(partLanded.phase).toBe('paused');
    expect(partLanded.sent).toBe(16);
    expect(readyToComplete(partLanded)).toBe(false);

    const resumed = reduce(partLanded, { type: 'resume', at: 9000 });
    expect(resumed.phase).toBe('sending');
    expect(resumed.samples).toEqual([{ at: 9000, sent: 16 }]);
  });

  it('counts the tries of a failed part and goes back to sending after a success', () => {
    const retrying = run(
      [
        { type: 'retry', attempt: 1 },
        { type: 'retry', attempt: 2 },
      ],
      started,
    );
    expect(retrying.phase).toBe('retrying');
    expect(retrying.attempt).toBe(2);

    const recovered = reduce(retrying, { type: 'sent', received: 16, at: 4000 });
    expect(recovered.phase).toBe('sending');
    expect(recovered.attempt).toBe(0);
  });

  it('fails and cancels only an active upload', () => {
    const failed = reduce(started, { type: 'failed', code: 'disk_full' });
    expect(failed.phase).toBe('failed');
    expect(failed.error).toBe('disk_full');
    expect(reduce(INITIAL_UPLOAD, { type: 'failed', code: 'x' })).toBe(INITIAL_UPLOAD);

    expect(reduce(failed, { type: 'cancel' }).phase).toBe('cancelled');
    expect(reduce(INITIAL_UPLOAD, { type: 'cancel' })).toBe(INITIAL_UPLOAD);
  });

  it('refuses a second start while an upload is active', () => {
    const other = { ...FILE, name: 'other.zip' };

    expect(reduce(started, { type: 'start', kind: 'dem', file: other, activate: false })).toBe(started);
  });

  it('ignores events that do not fit the phase', () => {
    expect(reduce(INITIAL_UPLOAD, { type: 'created', session: session(), at: 0 })).toBe(INITIAL_UPLOAD);
    expect(reduce(INITIAL_UPLOAD, { type: 'resume', at: 0 })).toBe(INITIAL_UPLOAD);
    expect(reduce(started, { type: 'completed', version: VERSION })).toBe(started);
  });

  it('follows the version state only for its own version', () => {
    const done = { ...started, phase: 'done' as const, version: VERSION };
    const ready = { ...VERSION, state: 'ready' as const };

    expect(reduce(done, { type: 'version', version: ready }).version?.state).toBe('ready');
    expect(reduce(done, { type: 'version', version: { ...ready, id: 'other' } })).toBe(done);
  });

  it('doubles the wait between tries up to 30 seconds', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });

  it('computes the throughput and the remaining time from the samples', () => {
    const moving = run(
      [
        { type: 'sent', received: 16, at: 2000 },
        { type: 'sent', received: 32, at: 4000 },
      ],
      { ...started, samples: [{ at: 0, sent: 0 }] },
    );

    expect(throughput(moving.samples)).toBe(8);
    expect(etaSeconds(moving)).toBe(1);
    expect(throughput([])).toBeNull();
  });

  it('keeps a record for a reload until the upload ends', () => {
    expect(resumeRecord(INITIAL_UPLOAD)).toBeNull();
    const record = resumeRecord(started);
    expect(record).toEqual({ uploadId: 'upload-1', kind: 'trees-grid', ...FILE });
    expect(resumeRecord(reduce(started, { type: 'cancel' }))).toBeNull();

    expect(sameFile(record, 'trees-grid', FILE)).toBe(true);
    expect(sameFile(record, 'trees-grid', { ...FILE, lastModified: 1 })).toBe(false);
    expect(sameFile(record, 'dem', FILE)).toBe(false);
  });

  it('checks the shape of a stored record', () => {
    expect(asResumeRecord({ uploadId: 'u', kind: 'dem', ...FILE })).not.toBeNull();
    expect(asResumeRecord({ uploadId: 'u', kind: 'dem', name: 'x' })).toBeNull();
    expect(asResumeRecord('text')).toBeNull();
  });
});
