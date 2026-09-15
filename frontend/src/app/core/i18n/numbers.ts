/** Zwischen zwei Angaben derselben Zeile. */
export const SEPARATOR = ' · ';

/** Tausender mit Leerzeichen, wie die Bretter sie schreiben: `1 284`. */
export function grouped(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Fügt die Teile einer Zeile zusammen. Was fehlt, fällt weg. */
export function joined(parts: readonly (string | null | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(SEPARATOR);
}
