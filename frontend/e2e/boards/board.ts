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

/** Eine Karte des Baustein-Boards mit Lage, Groesse und Dateinamen. */
export interface BoardCard {
  readonly selector: string;
  readonly stem: string;
  readonly w: number;
  readonly h: number;
}

/** Deckt jede angebrochene Zeile ab, wie Playwright ein Element aufnimmt. */
function frame(box: { x: number; y: number; width: number; height: number }): {
  w: number;
  h: number;
} {
  return {
    w: Math.ceil(box.x + box.width) - Math.floor(box.x),
    h: Math.ceil(box.y + box.height) - Math.floor(box.y),
  };
}

/** Liest das Manifest der Baustein-Karten. */
export function boardCards(): BoardCard[] {
  return JSON.parse(readFileSync(join(__dirname, 'blocks-cards.json'), 'utf8')) as BoardCard[];
}

/**
 * Prüft Groesse und Bild einer Karte gegen `baseline/blocks/<stem>.png`,
 * Toleranz 0,5 % Pixel. Eine Karte aus `pending.json` bleibt aus.
 */
export async function expectCard(page: Page, card: BoardCard): Promise<void> {
  if (pendingStems().has(`blocks/${card.stem}`)) return;
  const block = page.locator(`[data-block="${card.selector}"]`);
  const box = await block.boundingBox();
  expect.soft(box ? frame(box) : null, card.selector).toEqual({ w: card.w, h: card.h });
  await expect.soft(block, card.selector).toHaveScreenshot(['blocks', `${card.stem}.png`]);
}

/** The neutral photo placeholder of `artefakte/mockups/design/lokal/uebergabe.mjs`. */
const PHOTO_PLACEHOLDER =
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">' +
  '<rect width="800" height="600" fill="#3a4a3f"/>' +
  '<path d="M0 430l210-170 150 120 130-90 310 250v60H0z" fill="#2c3a31"/></svg>';

/** Routes `/api/photos/{id}/{size}` to the placeholder. Call before `page.goto`. */
export async function neutralisePhotos(page: Page): Promise<void> {
  await page.route('**/api/photos/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: PHOTO_PLACEHOLDER });
  });
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
