const MEGABYTE = 1024 * 1024;

/** Die Größe eines Gebiets, wie sie im Board steht: „84 MB“. */
export function megabytes(bytes: number): string {
  return `${String(Math.round(bytes / MEGABYTE))} MB`;
}
