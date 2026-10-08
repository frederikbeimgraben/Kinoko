import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Reads width and height from the IHDR header of a PNG file. */
function size(file: string): { width: number; height: number } {
  const header = readFileSync(file).subarray(16, 24);
  return { width: header.readUInt32BE(0), height: header.readUInt32BE(4) };
}

function pendingStems(): Set<string> {
  const path = join(test.info().config.rootDir, 'boards/pending.json');
  return new Set(JSON.parse(readFileSync(path, 'utf8')) as string[]);
}

/** A board in `pending.json` does not run, and its steps also do not run. */
export function skipPending(board: string): void {
  test.skip(pendingStems().has(board), `${board} steht in pending.json`);
}

/** A card of the blocks board with position, size and file name. */
export interface BoardCard {
  readonly selector: string;
  readonly stem: string;
  readonly w: number;
  readonly h: number;
}

/** Covers each partial pixel row, as Playwright does when it captures an element. */
function frame(box: { x: number; y: number; width: number; height: number }): {
  w: number;
  h: number;
} {
  return {
    w: Math.ceil(box.x + box.width) - Math.floor(box.x),
    h: Math.ceil(box.y + box.height) - Math.floor(box.y),
  };
}

/** The cards that are not in `pending.json`. */
export function liveCards(): BoardCard[] {
  const pending = pendingStems();
  return boardCards().filter((card) => !pending.has(`blocks/${card.stem}`));
}

export function boardCards(): BoardCard[] {
  return JSON.parse(readFileSync(join(__dirname, 'blocks-cards.json'), 'utf8')) as BoardCard[];
}

/**
 * Compares size and image of a card with `baseline/blocks/<stem>.png` (0.5 % pixel tolerance).
 * Skips a card in `pending.json`. */
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

/** A board whose page keeps loading does not wait for network idle. */
export interface BoardOptions {
  idle?: boolean;
}

/**
 * Compares the view with `baseline/<board>.png` (0.5 % pixel tolerance). Skips a board in `pending.json`.
 * The board runs only in the project whose window fits the image. */
export async function expectBoard(page: Page, board: string, options: BoardOptions = {}): Promise<void> {
  test.skip(pendingStems().has(board), `${board} steht in pending.json`);
  const image = size(join(test.info().config.rootDir, 'boards/baseline', `${board}.png`));
  const viewport = page.viewportSize();
  const fits = viewport?.width === image.width && viewport.height === image.height;
  test.skip(!fits, `${board} gehört zu ${image.width}×${image.height}`);
  if (options.idle ?? true) await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot(`${board}.png`);
}
