import { decimal } from '../../core/i18n/numbers';

const MEGABYTE = 1_000_000;

/** A file size in megabytes, as the boards write it: "84 MB", "0,4 MB". Below 10 MB with one decimal. */
export function sizeText(bytes: number, locale: string): string {
  const megabytes = bytes / MEGABYTE;
  const digits = megabytes >= 10 || megabytes === 0 ? 0 : 1;
  return `${decimal(megabytes, locale, { maximumFractionDigits: digits, minimumFractionDigits: digits })} MB`;
}
