#!/usr/bin/env node
/** Prüft, ob jeder Board-Stem einen Test oder einen Pending-Eintrag hat. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXCLUDED = new Set(['SpecLevels']);
const EXPECT_BOARD = /expectBoard\(\s*[^,]+,\s*['"]([^'"]+)['"]/g;
// Die Karte prüft über eine eigene Hilfsfunktion; `guard` nennt dort das Board.
const GUARD = /guard\(\s*['"]([^'"]+)['"]/g;

/** Liest die Board-Stems aus den PNG-Dateien in `dir`. */
function baselineStems(dir) {
  return new Set(
    readdirSync(dir)
      .filter((name) => name.endsWith('.png'))
      .map((name) => name.slice(0, -4))
      .filter((stem) => !EXCLUDED.has(stem)),
  );
}

/** Liest die Board-Stems aus den `expectBoard`-Aufrufen unter `dir`. */
function testedStems(dir) {
  const stems = new Set();
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.spec.ts')) continue;
    const text = readFileSync(join(dir, name), 'utf8');
    for (const match of text.matchAll(EXPECT_BOARD)) stems.add(match[1]);
    for (const match of text.matchAll(GUARD)) stems.add(match[1]);
  }
  return stems;
}

/** Liest die Stems aus `pending.json` unter `dir`. */
function pendingStems(dir) {
  return new Set(JSON.parse(readFileSync(join(dir, 'pending.json'), 'utf8')));
}

/** Vergleicht baseline, Tests und `pending.json` unter `root/e2e/boards`. */
export function checkBoards(root) {
  const dir = join(root, 'e2e', 'boards');
  const baseline = baselineStems(join(dir, 'baseline'));
  const tested = testedStems(dir);
  const pending = pendingStems(dir);

  const checked = [...baseline].filter((stem) => tested.has(stem) && !pending.has(stem)).sort();
  const waiting = [...baseline].filter((stem) => pending.has(stem)).sort();
  const missing = [...baseline].filter((stem) => !tested.has(stem) && !pending.has(stem)).sort();

  return { checked, pending: waiting, missing };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const { checked, pending, missing } = checkBoards(ROOT);

  for (const stem of missing) {
    console.log(`${stem}: kein Test und kein Eintrag in pending.json`);
  }
  console.log(`Boards: geprüft ${checked.length}, ausstehend ${pending.length}.`);

  if (missing.length > 0) {
    console.error(`Boards ohne Test und ohne Pending-Eintrag: ${missing.length}.`);
    process.exit(1);
  }
}
