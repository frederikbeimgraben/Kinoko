#!/usr/bin/env node
/**
 * Prüft Dateigrössen in `src/app`.
 * Grenzen: `features/` eng, `ui/` und `core/` weiter (CLAUDE.md).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP_ROOT = join(ROOT, 'src', 'app');
const ALLOW_PATH = join(ROOT, 'tools', 'lint-allow.json');
const WRITE_ALLOW = process.argv.includes('--write-allow');

const LIMITS = {
  features: { '.ts': 250, '.html': 150 },
  ui: { '.ts': 300, '.html': 300 },
  core: { '.ts': 300, '.html': 300 },
};

/** Ordner in `src/app`, für die eine Grenze gilt. */
function zone(relPath) {
  const first = relPath.split(sep)[0];
  return LIMITS[first] ? first : null;
}

function collectFiles(folder, found) {
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) {
      collectFiles(path, found);
      continue;
    }
    if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) found.push(path);
    else if (name.endsWith('.html')) found.push(path);
  }
  return found;
}

function allViolations() {
  const found = [];
  for (const file of collectFiles(APP_ROOT, [])) {
    const relPath = relative(APP_ROOT, file);
    const area = zone(relPath);
    if (!area) continue;
    const ext = file.endsWith('.html') ? '.html' : '.ts';
    const limit = LIMITS[area][ext];
    const lines = readFileSync(file, 'utf8').split('\n').length;
    if (lines > limit) {
      found.push({ path: relative(ROOT, file), lines, limit });
    }
  }
  return found;
}

function readAllow() {
  try {
    return JSON.parse(readFileSync(ALLOW_PATH, 'utf8'));
  } catch {
    return {};
  }
}

const violations = allViolations();
const keys = [...new Set(violations.map((v) => v.path))].sort();

if (WRITE_ALLOW) {
  const allow = readAllow();
  allow.size = keys;
  const { writeFileSync } = await import('node:fs');
  writeFileSync(ALLOW_PATH, JSON.stringify(allow, null, 2) + '\n');
  console.log(`${keys.length} Ausnahmen für size geschrieben.`);
  process.exit(0);
}

const allowed = new Set(readAllow().size ?? []);
const reported = violations.filter((v) => !allowed.has(v.path));

for (const v of reported) {
  console.log(`${v.path}:${v.lines}  size  ${v.lines} Zeilen, Grenze ${v.limit}`);
}
if (reported.length > 0) {
  console.error(`Neue Größenverstöße: ${reported.length}.`);
  process.exit(1);
}
console.log('Keine neuen Größenverstöße.');
