/** The separator between two values on one line. */
export const SEPARATOR = ' · ';

/** A number in the UI language. The default is one decimal place. */
export function decimal(
  value: number,
  locale: string,
  options: Intl.NumberFormatOptions = { maximumFractionDigits: 1 },
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/** Groups thousands with spaces, as the boards show them: `1 284`. */
export function grouped(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Joins the parts of a line. Missing parts are skipped. */
export function joined(parts: readonly (string | null | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(SEPARATOR);
}
