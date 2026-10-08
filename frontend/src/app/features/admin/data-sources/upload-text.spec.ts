import { INITIAL_UPLOAD, type UploadState } from './upload-machine';
import { uploadError, uploadLines } from './upload-text';

function text(key: string, values: Record<string, string | number> = {}): string {
  const shown = Object.entries(values).map(([name, value]) => `${name}=${value}`);
  return shown.length === 0 ? key : `${key}(${shown.join(',')})`;
}

const FILE = { name: 'trees.parquet', size: 4000, lastModified: 1 };

const sending: UploadState = {
  ...INITIAL_UPLOAD,
  phase: 'sending',
  kind: 'trees-grid',
  file: FILE,
  uploadId: 'upload-1',
  sent: 2000,
  hashed: 1000,
  samples: [
    { at: 0, sent: 0 },
    { at: 2000, sent: 2000 },
  ],
};

describe('upload text', () => {
  it('shows the rate, the remaining time and the hash share while the parts go out', () => {
    const lines = uploadLines(sending, text, 'en');

    expect(lines.percent).toBe(50);
    expect(lines.progress).toContain('admin.upload.rate');
    expect(lines.progress).toContain('admin.upload.eta');
    expect(lines.hash).toBe('admin.upload.hashing(prozent=25)');
    expect(lines.note).toBe('');
  });

  it('shows the step and no rate outside of the send phase', () => {
    const paused = uploadLines({ ...sending, phase: 'paused', sha256: 'ab' }, text, 'en');

    expect(paused.progress).not.toContain('admin.upload.rate');
    expect(paused.progress).not.toContain('admin.upload.eta');
    expect(paused.hash).toBe('admin.upload.hashed');
    expect(paused.note).toBe('admin.upload.paused');

    expect(uploadLines({ ...sending, phase: 'retrying', attempt: 3 }, text, 'en').note).toBe(
      'admin.upload.retrying(versuch=3)',
    );
  });

  it('shows no rate before the second sample and an empty upload without a file', () => {
    expect(uploadLines({ ...sending, samples: [] }, text, 'en').progress).not.toContain('admin.upload.rate');

    const empty = uploadLines(INITIAL_UPLOAD, text, 'en');
    expect(empty.percent).toBe(0);
    expect(empty.hash).toBe('admin.upload.hashing(prozent=0)');
  });

  it('gives the text of a known error code, a general text otherwise, and nothing before a failure', () => {
    expect(uploadError({ ...sending, phase: 'failed', error: 'disk_full' }, text)).toBe(
      'admin.upload.error.disk_full',
    );
    expect(uploadError({ ...sending, phase: 'failed', error: 'odd' }, text)).toBe('admin.upload.error.failed');
    expect(uploadError({ ...sending, phase: 'failed', error: null }, text)).toBe('admin.upload.error.failed');
    expect(uploadError(sending, text)).toBe('');
  });
});
