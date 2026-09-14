#!/usr/bin/env node
/** Spiegelt die Board-Bilder der Artefakte nach `e2e/boards/baseline`. */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const TARGET = join(ROOT, 'e2e/boards/baseline');
const EXCLUDED = new Set(['SpecLevels.png', 'Blocks.png']);

/** Sucht `artefakte/mockups/bilder` von hier aufwärts. */
function source() {
  let folder = ROOT;
  for (;;) {
    const hit = join(folder, 'artefakte/mockups/bilder');
    if (existsSync(hit)) return hit;
    const up = dirname(folder);
    if (up === folder) return null;
    folder = up;
  }
}

const from = source();
if (!from) {
  console.log('artefakte/mockups/bilder fehlt, die eingecheckten Bilder bleiben');
  process.exit(0);
}

mkdirSync(TARGET, { recursive: true });
let fresh = 0;
let same = 0;
for (const name of readdirSync(from)) {
  if (!name.endsWith('.png') || EXCLUDED.has(name)) continue;
  const target = join(TARGET, name);
  if (existsSync(target) && readFileSync(target).equals(readFileSync(join(from, name)))) {
    same += 1;
    continue;
  }
  copyFileSync(join(from, name), target);
  fresh += 1;
}
console.log(`Boards: ${fresh} neu, ${same} unverändert, Quelle ${from}`);
