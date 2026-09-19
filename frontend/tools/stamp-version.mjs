#!/usr/bin/env node
/** Schreibt die Git-Version als `prebuild` in `src/app/core/version.generated.ts`. */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TARGET = new URL('../src/app/core/version.generated.ts', import.meta.url);
const FALLBACK = 'dev';

/** Die Version aus Git, oder `dev` ohne Git-Verzeichnis oder Tags. */
export function describe() {
  try {
    return execFileSync('git', ['describe', '--tags', '--always'], { encoding: 'utf8' }).trim() || FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export function content(version) {
  return `export const APP_VERSION = '${version}';\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = describe();
  writeFileSync(TARGET, content(version), 'utf8');
  console.log(`Version gestempelt: ${version}`);
}
