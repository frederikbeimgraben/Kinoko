#!/usr/bin/env node
/** Rendert jede Fixtur-Seite der Mockups mit demselben Chromium nach PNG. */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { FLAGS, fontSheet } from './render-boards.mjs';

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

/** Liest Breite und Höhe aus der ersten Fläche im Rumpf der Fixtur-Seite. */
export function sizeOf(source) {
  const body = source.slice(source.indexOf('</helmet>'));
  const match = /width:(\d+)px;height:(\d+)px/.exec(body);
  return match === null ? null : { width: Number(match[1]), height: Number(match[2]) };
}

/** Jede Fixtur-Seite mit ihrem Namen und ihrer Größe. */
export function fixtures(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.html'))
    .map((name) => ({ stem: name.replace(/\.html$/, ''), file: join(dir, name) }))
    .map((one) => ({ ...one, size: sizeOf(readFileSync(one.file, 'utf8')) }))
    .filter((one) => one.size !== null);
}

async function render(root) {
  const dir = findSource(root, 'artefakte/mockups/code/fixtures');
  if (dir === null) throw new Error('artefakte/mockups/code/fixtures fehlt');
  const sheet = fontSheet(join(root, 'node_modules/@stupa-makers/ui-kit/assets/fonts'));
  const browser = await chromium.launch({ executablePath: process.env['BROWSER_PATH'], args: FLAGS });
  const context = await browser.newContext({ deviceScaleFactor: 1, colorScheme: 'dark' });
  // Die Fixtur holt Archivo von Google; hier gilt die Schrift der App.
  await context.route('https://fonts.googleapis.com/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/css', body: sheet });
  });
  const page = await context.newPage();
  let count = 0;
  for (const one of fixtures(dir)) {
    await page.setViewportSize(one.size);
    await page.goto(pathToFileURL(one.file).href);
    await page.evaluate(() => document.fonts.ready);
    const shot = await page.screenshot();
    const target = join(dir, `${one.stem}.png`);
    // Ein gleiches Bild bleibt liegen: sonst trüge jeder Lauf neue Dateien.
    if (!existsSync(target) || !readFileSync(target).equals(shot)) {
      writeFileSync(target, shot);
      count += 1;
    }
  }
  await browser.close();
  return { count, dir };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
  const { count, dir } = await render(ROOT);
  console.log(`Fixturen gerendert: ${count} neu, Ziel ${dir}`);
}
