#!/usr/bin/env node
/** Checks for selector collisions between `ui/` and `features/`.
 * The same suffix without an import of the tile is a chance match. */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELECTOR = /selector:\s*'(app-[a-z0-9-]+)'/;
const IMPORT_FROM = /from\s+['"]([^'"]+)['"]/g;

function collectFiles(folder, found) {
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) collectFiles(path, found);
    else if (name.endsWith('.ts')) found.push(path);
  }
  return found;
}

/** Finds `selector: 'app-...'` and its line in a file, if it exists. */
function selectorOf(source) {
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const match = SELECTOR.exec(lines[i]);
    if (match) return { selector: match[1], line: i + 1 };
  }
  return null;
}

/** The last segment after the last `-`, with the hyphen, for example `-row`. */
function suffixOf(selector) {
  return selector.slice(selector.lastIndexOf('-'));
}

/** An import path is from `ui` when `ui` is a separate segment. */
function importsFromUi(source) {
  for (const match of source.matchAll(IMPORT_FROM)) {
    if (match[1].split('/').includes('ui')) return true;
  }
  return false;
}

/** Finds selector collisions under `root/src/app`. */
export function findViolations(root) {
  const appRoot = join(root, 'src', 'app');
  const files = collectFiles(appRoot, []);
  const components = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const found = selectorOf(source);
    if (!found) continue;
    const relPath = relative(appRoot, file);
    components.push({
      path: relative(root, file),
      zone: relPath.split(sep)[0],
      selector: found.selector,
      line: found.line,
      source,
    });
  }

  const uiBySuffix = new Map();
  for (const c of components.filter((c) => c.zone === 'ui')) {
    const suffix = suffixOf(c.selector);
    if (!uiBySuffix.has(suffix)) uiBySuffix.set(suffix, []);
    uiBySuffix.get(suffix).push(c);
  }

  const violations = [];
  for (const c of components.filter((c) => c.zone === 'features')) {
    const matches = uiBySuffix.get(suffixOf(c.selector)) ?? [];
    if (matches.length === 0) continue;
    if (importsFromUi(c.source)) continue;
    const names = matches.map((m) => m.selector).join(', ');
    violations.push({
      path: c.path,
      line: c.line,
      key: `${c.path}:${c.selector}`,
      reason: `Suffix wie ${names} ohne Import aus ui/`,
    });
  }

  const bySelector = new Map();
  for (const c of components) {
    if (!bySelector.has(c.selector)) bySelector.set(c.selector, []);
    bySelector.get(c.selector).push(c);
  }
  for (const [selector, group] of bySelector) {
    if (group.length < 2) continue;
    for (const c of group) {
      const others = group
        .filter((g) => g !== c)
        .map((g) => g.path)
        .join(', ');
      violations.push({
        path: c.path,
        line: c.line,
        key: `${c.path}:${selector}`,
        reason: `Selektor auch in ${others}`,
      });
    }
  }
  return violations;
}

function readAllow(allowPath) {
  try {
    return JSON.parse(readFileSync(allowPath, 'utf8'));
  } catch {
    return {};
  }
}

/** Reports selector collisions under `root`, except the ones that `allowPath` allows. */
export function report(root, allowPath) {
  const allowed = new Set(readAllow(allowPath).selectors ?? []);
  return findViolations(root).filter((v) => !allowed.has(v.key));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const ALLOW_PATH = join(ROOT, 'tools', 'lint-allow.json');

  if (process.argv.includes('--write-allow')) {
    const keys = [...new Set(findViolations(ROOT).map((v) => v.key))].sort();
    const allow = readAllow(ALLOW_PATH);
    allow.selectors = keys;
    writeFileSync(ALLOW_PATH, JSON.stringify(allow, null, 2) + '\n');
    console.log(`${keys.length} Ausnahmen für selectors geschrieben.`);
    process.exit(0);
  }

  const reported = report(ROOT, ALLOW_PATH);
  for (const v of reported) console.log(`${v.path}:${v.line}  selectors  ${v.reason}`);
  if (reported.length > 0) {
    console.error(`Neue Selektorverstöße: ${reported.length}.`);
    process.exit(1);
  }
  console.log('Keine neuen Selektorverstöße.');
}
