import type { DataSourceAccept } from '../../../core/api/models';

/** The byte units that `Intl.NumberFormat` knows, from small to large. */
const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;

/** A size in the largest unit below 1024, for example "1.4 GB". Plain bytes use the long name: "0 bytes", "0 Byte". */
export function bytesText(bytes: number, locale: string): string {
  const step = Math.min(BYTE_UNITS.length - 1, bytes > 0 ? Math.floor(Math.log(bytes) / Math.log(1024)) : 0);
  const value = bytes / 1024 ** step;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: BYTE_UNITS[step],
    unitDisplay: step === 0 ? 'long' : 'short',
    maximumFractionDigits: step === 0 ? 0 : 1,
  }).format(value);
}

/** A time span in its largest unit, for example "3 min" or "2 h". */
export function durationText(seconds: number, locale: string): string {
  const [value, unit] =
    seconds >= 3600
      ? [seconds / 3600, 'hour']
      : seconds >= 60
        ? [Math.ceil(seconds / 60), 'minute']
        : [Math.max(1, Math.ceil(seconds)), 'second'];
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: unit === 'hour' ? 1 : 0,
  }).format(value);
}

/** A point in time as a short date and time in the language of the interface. */
export function momentText(iso: string | null | undefined, locale: string): string {
  if (iso === null || iso === undefined || iso === '') return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

/** The first 12 characters of a SHA-256. They are enough to tell two versions apart. */
export function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 12) : '';
}

/** The problem of a chosen file before the upload: a wrong type, a size over the limit, or none. */
export type FileProblem = 'type' | 'size' | null;

/** Checks the extension and the size of a file against the accepted format of a kind. */
export function fileProblem(name: string, size: number, accept: DataSourceAccept): FileProblem {
  const lower = name.toLocaleLowerCase();
  const typeOk =
    accept.extensions.length === 0 ||
    accept.extensions.some((ext) => lower.endsWith(ext.toLocaleLowerCase()));
  if (!typeOk) return 'type';
  return size > accept.maxBytes ? 'size' : null;
}

/** A metadata value as text: a list joins its items, an object shows its JSON. */
export function metaValue(value: unknown, locale: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number')
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value);
  if (Array.isArray(value))
    return value
      .map((item) => (typeof item === 'number' ? String(item) : metaValue(item, locale)))
      .join(', ');
  return typeof value === 'string' ? value : JSON.stringify(value);
}
