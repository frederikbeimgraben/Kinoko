#!/usr/bin/env node
/**
 * Schreibt `core/i18n/texts.generated.json` aus `backend/daten/texte.json`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SOURCE = new URL('../../backend/daten/texte.json', import.meta.url);
const TARGET = new URL('../src/app/core/i18n/texts.generated.json', import.meta.url);

/** Die Vorgabe, je Sprache nach Schlüssel geordnet. */
export function sorted(source) {
  const out = {};
  for (const locale of Object.keys(source).sort()) {
    out[locale] = Object.fromEntries(
      Object.keys(source[locale])
        .sort()
        .map((key) => [key, source[locale][key]]),
    );
  }
  return out;
}

export function catalogue() {
  return sorted(JSON.parse(readFileSync(SOURCE, 'utf8')));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const built = catalogue();
  writeFileSync(TARGET, JSON.stringify(built, null, 2) + '\n', 'utf8');
  const count = Object.keys(built[Object.keys(built)[0]] ?? {}).length;
  console.log(`${count} Schlüssel je Sprache geschrieben.`);
}
