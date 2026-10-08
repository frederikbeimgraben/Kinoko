import { joined } from '../../../core/i18n/numbers';
import type { Translate } from '../runs.rows';
import { bytesText, durationText } from './format';
import { UPLOAD_ERROR_TEXT } from './labels';
import { etaSeconds, percentHashed, percentSent, throughput, type UploadState } from './upload-machine';

/** The text lines of a running upload. */
export interface UploadLines {
  readonly percent: number;
  /** For example "1.2 GB of 4 GB · 24 MB/s · 3 min left". */
  readonly progress: string;
  readonly hash: string;
  /** The current step, for example "Paused", or empty while the parts go out. */
  readonly note: string;
}

/** The progress, the throughput, the remaining time and the hash of an upload as text. */
export function uploadLines(state: UploadState, text: Translate, locale: string): UploadLines {
  const size = state.file?.size ?? 0;
  const rate = state.phase === 'sending' ? throughput(state.samples) : null;
  const eta = state.phase === 'sending' ? etaSeconds(state) : null;
  const hashed = Math.floor(percentHashed(state));
  const notes: Partial<Record<UploadState['phase'], string>> = {
    creating: text('admin.upload.creating'),
    paused: text('admin.upload.paused'),
    retrying: text('admin.upload.retrying', { versuch: state.attempt }),
    completing: text('admin.upload.completing'),
    done: text('admin.upload.done'),
  };
  return {
    percent: percentSent(state),
    progress: joined([
      text('admin.upload.progress', {
        gesendet: bytesText(state.sent, locale),
        gesamt: bytesText(size, locale),
      }),
      rate === null ? null : text('admin.upload.rate', { rate: bytesText(rate, locale) }),
      eta === null ? null : text('admin.upload.eta', { zeit: durationText(eta, locale) }),
    ]),
    hash:
      state.sha256 === null ? text('admin.upload.hashing', { prozent: hashed }) : text('admin.upload.hashed'),
    note: notes[state.phase] ?? '',
  };
}

/** The text of a failed upload, or an empty text. */
export function uploadError(state: UploadState, text: Translate): string {
  if (state.phase !== 'failed') return '';
  const code = state.error ?? '';
  return text(code in UPLOAD_ERROR_TEXT ? UPLOAD_ERROR_TEXT[code] : 'admin.upload.error.failed');
}
