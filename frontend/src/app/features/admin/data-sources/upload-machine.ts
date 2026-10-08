import type { DataSourceKind, DataSourceVersion, UploadSession } from '../../../core/api/models';

/** The steps of an upload. `retrying` waits for the next try of a failed part. */
export type UploadPhase =
  'idle' | 'creating' | 'sending' | 'retrying' | 'paused' | 'completing' | 'done' | 'failed' | 'cancelled';

/** The facts of the chosen file that identify it again after a reload. */
export interface FileFacts {
  readonly name: string;
  readonly size: number;
  readonly lastModified: number;
}

/** The record in `localStorage` that lets an upload continue after a reload. */
export interface ResumeRecord extends FileFacts {
  readonly uploadId: string;
  readonly kind: DataSourceKind;
}

/** A point of the progress: the time in ms and the bytes the server has. */
export interface Sample {
  readonly at: number;
  readonly sent: number;
}

export interface UploadState {
  readonly phase: UploadPhase;
  readonly kind: DataSourceKind | null;
  readonly file: FileFacts | null;
  readonly activate: boolean;
  readonly uploadId: string | null;
  readonly partSize: number;
  /** The bytes that the server confirmed. */
  readonly sent: number;
  /** The number of the current try of the current part. 0 is the first try. */
  readonly attempt: number;
  readonly hashed: number;
  readonly sha256: string | null;
  readonly version: DataSourceVersion | null;
  readonly error: string | null;
  readonly samples: readonly Sample[];
}

export type UploadEvent =
  | {
      readonly type: 'start';
      readonly kind: DataSourceKind;
      readonly file: FileFacts;
      readonly activate: boolean;
    }
  | { readonly type: 'created'; readonly session: UploadSession; readonly at: number }
  | { readonly type: 'sent'; readonly received: number; readonly at: number }
  | { readonly type: 'retry'; readonly attempt: number }
  | { readonly type: 'pause' }
  | { readonly type: 'resume'; readonly at: number }
  | { readonly type: 'hashed'; readonly bytes: number }
  | { readonly type: 'digest'; readonly hex: string }
  | { readonly type: 'completing' }
  | { readonly type: 'completed'; readonly version: DataSourceVersion }
  | { readonly type: 'version'; readonly version: DataSourceVersion }
  | { readonly type: 'failed'; readonly code: string }
  | { readonly type: 'cancel' }
  | { readonly type: 'reset' };

/** The part size of the contract, 16 MiB. The server sends its own value with the session. */
export const DEFAULT_PART_SIZE = 16 * 1024 * 1024;

/** A failed part gets this many new tries before the upload fails. */
export const MAX_RETRIES = 6;

const FIRST_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

/** The throughput uses the samples of this time window. */
const RATE_WINDOW_MS = 20_000;

export const INITIAL_UPLOAD: UploadState = {
  phase: 'idle',
  kind: null,
  file: null,
  activate: true,
  uploadId: null,
  partSize: DEFAULT_PART_SIZE,
  sent: 0,
  attempt: 0,
  hashed: 0,
  sha256: null,
  version: null,
  error: null,
  samples: [],
};

const ACTIVE: readonly UploadPhase[] = ['creating', 'sending', 'retrying', 'paused', 'completing'];
const CANCELLABLE: readonly UploadPhase[] = ['creating', 'sending', 'retrying', 'paused', 'failed'];

/** True while an upload holds a session: a new upload must wait. */
export function isActive(phase: UploadPhase): boolean {
  return ACTIVE.includes(phase);
}

/** Keeps the samples of the rate window, plus the one before it as the start point. */
function sampled(samples: readonly Sample[], next: Sample): readonly Sample[] {
  const all = [...samples, next];
  const first = all.findIndex((one) => one.at >= next.at - RATE_WINDOW_MS);
  return all.slice(Math.max(0, first - 1));
}

/** The next state of an upload. Events that do not fit the phase change nothing. */
export function reduce(state: UploadState, event: UploadEvent): UploadState {
  switch (event.type) {
    case 'start':
      return isActive(state.phase)
        ? state
        : {
            ...INITIAL_UPLOAD,
            phase: 'creating',
            kind: event.kind,
            file: event.file,
            activate: event.activate,
          };
    case 'created':
      if (state.phase !== 'creating') return state;
      return {
        ...state,
        phase: 'sending',
        uploadId: event.session.id,
        partSize: event.session.partSize > 0 ? event.session.partSize : DEFAULT_PART_SIZE,
        sent: event.session.receivedBytes,
        samples: [{ at: event.at, sent: event.session.receivedBytes }],
      };
    case 'sent':
      if (!['sending', 'retrying', 'paused'].includes(state.phase)) return state;
      return {
        ...state,
        phase: state.phase === 'paused' ? 'paused' : 'sending',
        sent: event.received,
        attempt: 0,
        samples: sampled(state.samples, { at: event.at, sent: event.received }),
      };
    case 'retry':
      return state.phase === 'sending' || state.phase === 'retrying'
        ? { ...state, phase: 'retrying', attempt: event.attempt }
        : state;
    case 'pause':
      return state.phase === 'sending' || state.phase === 'retrying' ? { ...state, phase: 'paused' } : state;
    case 'resume':
      return state.phase === 'paused'
        ? { ...state, phase: 'sending', attempt: 0, samples: [{ at: event.at, sent: state.sent }] }
        : state;
    case 'hashed':
      return state.file === null ? state : { ...state, hashed: Math.min(event.bytes, state.file.size) };
    case 'digest':
      return state.file === null ? state : { ...state, sha256: event.hex, hashed: state.file.size };
    case 'completing':
      return readyToComplete(state) ? { ...state, phase: 'completing' } : state;
    case 'completed':
      return state.phase === 'completing' ? { ...state, phase: 'done', version: event.version } : state;
    case 'version':
      return state.version?.id === event.version.id ? { ...state, version: event.version } : state;
    case 'failed':
      return isActive(state.phase) ? { ...state, phase: 'failed', error: event.code } : state;
    case 'cancel':
      // The server installs the version after the complete request, so a cancel cannot stop it.
      return CANCELLABLE.includes(state.phase) ? { ...state, phase: 'cancelled' } : state;
    case 'reset':
      return isActive(state.phase) ? state : INITIAL_UPLOAD;
  }
}

/** The byte range of the next part, or `null` when the server has each byte. */
export function nextPart(state: UploadState): { readonly start: number; readonly end: number } | null {
  if (state.file === null || state.sent >= state.file.size) return null;
  return { start: state.sent, end: Math.min(state.sent + state.partSize, state.file.size) };
}

/** True when the server has each byte and the hash is known. */
export function readyToComplete(state: UploadState): boolean {
  return (
    state.phase === 'sending' && state.file !== null && state.sent >= state.file.size && state.sha256 !== null
  );
}

/** The wait before the try `attempt` (1, 2, ...): it doubles from one second up to 30 seconds. */
export function backoffMs(attempt: number): number {
  return Math.min(MAX_DELAY_MS, FIRST_DELAY_MS * 2 ** Math.max(0, attempt - 1));
}

/** The sent share from 0 to 100. */
export function percentSent(state: UploadState): number {
  const size = state.file?.size ?? 0;
  return size === 0 ? 0 : (100 * state.sent) / size;
}

/** The hashed share from 0 to 100. */
export function percentHashed(state: UploadState): number {
  const size = state.file?.size ?? 0;
  return size === 0 ? 0 : (100 * state.hashed) / size;
}

/** The bytes per second over the rate window, or `null` before two samples exist. */
export function throughput(samples: readonly Sample[]): number | null {
  if (samples.length < 2) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const seconds = (last.at - first.at) / 1000;
  return seconds <= 0 ? null : (last.sent - first.sent) / seconds;
}

/** The seconds until the server has each byte, or `null` without a rate. */
export function etaSeconds(state: UploadState): number | null {
  const rate = throughput(state.samples);
  if (rate === null || rate <= 0 || state.file === null) return null;
  return Math.ceil((state.file.size - state.sent) / rate);
}

/** The record that lets this upload continue after a reload, or `null` when nothing is open. */
export function resumeRecord(state: UploadState): ResumeRecord | null {
  if (state.uploadId === null || state.kind === null || state.file === null) return null;
  if (state.phase === 'done' || state.phase === 'cancelled' || state.phase === 'idle') return null;
  return { uploadId: state.uploadId, kind: state.kind, ...state.file };
}

/** True when the file is the file of the record: same kind, name, size and change time. */
export function sameFile(record: ResumeRecord | null, kind: DataSourceKind, file: FileFacts): boolean {
  return (
    record !== null &&
    record.kind === kind &&
    record.name === file.name &&
    record.size === file.size &&
    record.lastModified === file.lastModified
  );
}

/** Checks a value from storage. A bad shape gives `null`. */
export function asResumeRecord(value: unknown): ResumeRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Partial<ResumeRecord>;
  const valid =
    typeof record.uploadId === 'string' &&
    typeof record.kind === 'string' &&
    typeof record.name === 'string' &&
    typeof record.size === 'number' &&
    typeof record.lastModified === 'number';
  return valid ? (record as ResumeRecord) : null;
}

/** The file facts that identify a file. */
export function factsOf(file: File): FileFacts {
  return { name: file.name, size: file.size, lastModified: file.lastModified };
}
