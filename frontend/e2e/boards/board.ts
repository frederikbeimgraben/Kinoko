import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Liest Breite und Höhe aus dem IHDR-Kopf einer PNG-Datei. */
function size(file: string): { width: number; height: number } {
  const header = readFileSync(file).subarray(16, 24);
  return { width: header.readUInt32BE(0), height: header.readUInt32BE(4) };
}

/** Liest die Stems aus `pending.json`. */
function pendingStems(): Set<string> {
  const path = join(test.info().config.rootDir, 'boards/pending.json');
  return new Set(JSON.parse(readFileSync(path, 'utf8')) as string[]);
}

/** Ein Board aus `pending.json` läuft gar nicht, auch nicht seine Schritte. */
export function skipPending(board: string): void {
  test.skip(pendingStems().has(board), `${board} steht in pending.json`);
}

/** Ein Board, dessen Seite noch lädt, wartet nicht auf Ruhe im Netz. */
export interface BoardOptions {
  idle?: boolean;
}

/**
 * Vergleicht die Ansicht mit `baseline/<board>.png`, Toleranz 0,5 % Pixel.
 * Ein Board aus `pending.json` läuft nicht. Das Board läuft sonst nur in
 * dem Projekt, dessen Fenster zum Bild passt.
 */
export async function expectBoard(page: Page, board: string, options: BoardOptions = {}): Promise<void> {
  test.skip(pendingStems().has(board), `${board} steht in pending.json`);
  const image = size(join(test.info().config.rootDir, 'boards/baseline', `${board}.png`));
  const viewport = page.viewportSize();
  const fits = viewport?.width === image.width && viewport.height === image.height;
  test.skip(!fits, `${board} gehört zu ${image.width}×${image.height}`);
  if (options.idle ?? true) await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot(`${board}.png`);
}
