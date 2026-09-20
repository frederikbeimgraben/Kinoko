#!/usr/bin/env node
/** Copies board and component baselines from the design package into `e2e/boards`. */
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_DESIGN_DIR = '../../artefakte/mockups/design/uebergabe';
const BASELINE_DIR = 'e2e/boards/baseline';
const BLOCKS_DIR = `${BASELINE_DIR}/blocks`;
const SOURCE_FILE = `${BASELINE_DIR}/SOURCE.json`;
const NOT_BUILT_FILE = 'e2e/boards/not-built.json';

/** Resolves the design package directory: argument, env var, then the default path. */
export function designDir(root, override) {
  const value = override ?? process.env['DESIGN_DIR'] ?? DEFAULT_DESIGN_DIR;
  const dir = resolve(root, value);
  if (!existsSync(dir)) {
    throw new Error(`design directory not found: ${dir}`);
  }
  return dir;
}

/** One baseline to copy: its manifest name, source file and target path. */
function boardTargets(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  return manifest.boards.map((board) => ({
    name: board.board,
    source: join(dir, 'bilder', `${board.board}.png`),
    target: `${BASELINE_DIR}/${board.board}.png`,
  }));
}

/** Design components that no board uses. The app does not build them. */
function notBuilt(root) {
  const file = join(root, NOT_BUILT_FILE);
  return new Set(existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []);
}

function componentTargets(root, dir) {
  const catalogue = JSON.parse(readFileSync(join(dir, 'components.json'), 'utf8'));
  const skipped = notBuilt(root);
  return catalogue.components
    .filter((component) => component.kind === 'component' && !skipped.has(component.component))
    .map((component) => ({
      name: `blocks/${component.component}`,
      source: join(dir, 'bilder', `${component.component}.png`),
      target: `${BLOCKS_DIR}/${component.component}.png`,
    }));
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** Removes a stray png that no longer belongs to `keep`. */
function prune(dir, keep) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.png')) continue;
    const full = join(dir, name);
    if (!keep.has(full)) rmSync(full);
  }
}

/** Copies every board and component baseline and writes `SOURCE.json`. */
export function sync(root, dir) {
  const targets = [...boardTargets(dir), ...componentTargets(root, dir)];

  mkdirSync(join(root, BASELINE_DIR), { recursive: true });
  mkdirSync(join(root, BLOCKS_DIR), { recursive: true });
  prune(join(root, BASELINE_DIR), new Set(targets.map((item) => join(root, item.target))));
  prune(join(root, BLOCKS_DIR), new Set(targets.map((item) => join(root, item.target))));

  const recorded = {};
  const missing = [];
  for (const item of targets) {
    if (!existsSync(item.source)) {
      missing.push(item.name);
      continue;
    }
    const full = join(root, item.target);
    copyFileSync(item.source, full);
    recorded[item.name] = sha256(full);
  }
  writeFileSync(join(root, SOURCE_FILE), `${JSON.stringify(recorded, null, 2)}\n`, 'utf8');
  return { count: targets.length, missing };
}

/** Walks a baseline folder, keyed like `sync` keys `SOURCE.json`. */
function walk(dir, prefix, found) {
  if (!existsSync(dir)) return found;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, `${prefix}${name}/`, found);
      continue;
    }
    if (name === 'SOURCE.json' || !name.endsWith('.png')) continue;
    found.set(`${prefix}${name.slice(0, -4)}`, full);
  }
  return found;
}

/** Verifies every baseline against `SOURCE.json`. Changes nothing. */
export function check(root) {
  const sourceFile = join(root, SOURCE_FILE);
  if (!existsSync(sourceFile)) {
    return [`${SOURCE_FILE}: missing, run npm run boards:sync`];
  }
  const recorded = JSON.parse(readFileSync(sourceFile, 'utf8'));
  const found = walk(join(root, BASELINE_DIR), '', new Map());

  const problems = [];
  for (const [key, file] of found) {
    const expected = recorded[key];
    if (expected === undefined) {
      problems.push(`${key}: not listed in SOURCE.json`);
    } else if (sha256(file) !== expected) {
      problems.push(`${key}: differs from SOURCE.json`);
    }
  }
  for (const key of Object.keys(recorded)) {
    if (!found.has(key)) problems.push(`${key}: file missing`);
  }
  return problems.sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
  const args = process.argv.slice(2);

  if (args.includes('--check')) {
    const problems = check(ROOT);
    for (const problem of problems) console.error(problem);
    if (problems.length > 0) process.exit(1);
    console.log('Baselines match SOURCE.json.');
  } else {
    const override = args.find((arg) => !arg.startsWith('--'));
    const dir = designDir(ROOT, override);
    const result = sync(ROOT, dir);
    console.log(`${result.count - result.missing.length} of ${result.count} baselines synced from ${dir}.`);
    if (result.missing.length > 0) {
      console.error(`Missing source images: ${result.missing.join(', ')}`);
      process.exit(1);
    }
  }
}
