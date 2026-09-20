#!/usr/bin/env node
/** Prüft die Dateigrößen: `features/` eng, `ui/` und `core/` weiter. */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIMITS = {
  features: { '.ts': 250, '.html': 200 },
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

/** Sucht Grössenverstöße unter `root/src/app`. */
export function findViolations(root) {
  const appRoot = join(root, 'src', 'app');
  const found = [];
  for (const file of collectFiles(appRoot, [])) {
    const relPath = relative(appRoot, file);
    const area = zone(relPath);
    if (!area) continue;
    const ext = file.endsWith('.html') ? '.html' : '.ts';
    const limit = LIMITS[area][ext];
    const lines = readFileSync(file, 'utf8').split('\n').length;
    if (lines > limit) {
      found.push({ path: relative(root, file), lines, limit });
    }
  }
  return found;
}

function readAllow(allowPath) {
  try {
    return JSON.parse(readFileSync(allowPath, 'utf8'));
  } catch {
    return {};
  }
}

/** Meldet Grössenverstöße unter `root` ohne die in `allowPath` freigegebenen. */
export function report(root, allowPath) {
  const allowed = new Set(readAllow(allowPath).size ?? []);
  return findViolations(root).filter((v) => !allowed.has(v.path));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const ALLOW_PATH = join(ROOT, 'tools', 'lint-allow.json');

  if (process.argv.includes('--write-allow')) {
    const keys = [...new Set(findViolations(ROOT).map((v) => v.path))].sort();
    const allow = readAllow(ALLOW_PATH);
    allow.size = keys;
    writeFileSync(ALLOW_PATH, JSON.stringify(allow, null, 2) + '\n');
    console.log(`${keys.length} Ausnahmen für size geschrieben.`);
    process.exit(0);
  }

  const reported = report(ROOT, ALLOW_PATH);
  for (const v of reported) {
    console.log(`${v.path}:${v.lines}  size  ${v.lines} Zeilen, Grenze ${v.limit}`);
  }
  if (reported.length > 0) {
    console.error(`Neue Größenverstöße: ${reported.length}.`);
    process.exit(1);
  }
  console.log('Keine neuen Größenverstöße.');
}
