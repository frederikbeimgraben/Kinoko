#!/usr/bin/env node
/** Rendert jedes Artboard mit dem Chromium der Board-Tests nach `bilder/`. */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

/** Dieselben Schalter wie in `playwright.config.ts`. */
export const FLAGS = ['--disable-lcd-text', '--font-render-hinting=none'];

/** Sucht einen Ordner der Artefakte von `root` aufwärts. */
function findSource(root, part) {
  let folder = root;
  for (;;) {
    const hit = join(folder, part);
    if (existsSync(hit)) return hit;
    const up = dirname(folder);
    if (up === folder) return null;
    folder = up;
  }
}

/** Die Schrift der App, als Stilblatt für das Board. */
export function fontSheet(dir) {
  const faces = readdirSync(dir)
    .filter((name) => name.endsWith('.woff2'))
    .map((name) => {
      const weight = /-(\d+)-/.exec(name)?.[1] ?? '400';
      const data = readFileSync(join(dir, name)).toString('base64');
      return [
        '@font-face{font-family:"Archivo";font-style:normal;',
        `font-weight:${weight};font-display:block;`,
        `src:url(data:font/woff2;base64,${data}) format("woff2")}`,
      ].join('');
    });
  return faces.join('\n');
}

/** Ein Artboard je Eintrag der Canvas. */
export function artboards(dir) {
  const canvas = JSON.parse(readFileSync(join(dir, 'canvas.json'), 'utf8'));
  return canvas.artboards.map((board) => ({
    stem: board.file.replace(/\.dc\.html$/, ''),
    file: join(dir, board.file),
    width: board.w,
    height: board.h,
  }));
}

async function render(root) {
  const code = findSource(root, 'artefakte/mockups/code');
  if (!code) throw new Error('artefakte/mockups/code fehlt');
  const target = join(code, '..', 'bilder');
  mkdirSync(target, { recursive: true });
  const sheet = fontSheet(join(root, 'node_modules/@stupa-makers/ui-kit/assets/fonts'));

  const browser = await chromium.launch({
    executablePath: process.env['BROWSER_PATH'],
    args: FLAGS,
  });
  const context = await browser.newContext({ deviceScaleFactor: 1, colorScheme: 'dark' });
  // Das Board holt Archivo von Google; der Test hat nur die Schrift der App.
  await context.route('https://fonts.googleapis.com/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/css', body: sheet });
  });
  const page = await context.newPage();

  let count = 0;
  for (const board of artboards(code)) {
    await page.setViewportSize({ width: board.width, height: board.height });
    await page.goto(pathToFileURL(board.file).href);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(target, `${board.stem}.png`) });
    count += 1;
  }
  await browser.close();
  return { count, target };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
  const { count, target } = await render(ROOT);
  console.log(`Boards gerendert: ${count}, Ziel ${target}`);
}
