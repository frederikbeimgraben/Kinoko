import type { ExportFile } from './export-files';

/** Hands a file to the browser as a download. This is the one side effect of the export. */
export function saveFile(file: ExportFile, document: Document): void {
  const url = URL.createObjectURL(new Blob([file.content], { type: file.type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** The day of the export as `YYYY-MM-DD`, for the file name. */
export function exportDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}
