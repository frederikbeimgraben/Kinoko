#!/usr/bin/env node
/** Spiegelt die Board-Bilder der Artefakte nach `e2e/boards/baseline`. */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXCLUDED = new Set(['SpecLevels.png', 'Blocks.png']);

/** Sucht `artefakte/mockups/bilder` von `root` aufwärts. */
function findSource(root) {
  let folder = root;
  for (;;) {
    const hit = join(folder, 'artefakte/mockups/bilder');
    if (existsSync(hit)) return hit;
    const up = dirname(folder);
    if (up === folder) return null;
    folder = up;
  }
}

/** Spiegelt Board-Bilder nach `root/e2e/boards/baseline`. Gibt `null` ohne Quelle zurück. */
export function sync(root) {
  const from = findSource(root);
  if (!from) return null;

  const target = join(root, 'e2e/boards/baseline');
  mkdirSync(target, { recursive: true });
  const files = [];
  let fresh = 0;
  let same = 0;
  for (const name of readdirSync(from)) {
    if (!name.endsWith('.png')) continue;
    if (EXCLUDED.has(name)) {
      files.push({ name, action: 'skip-excluded' });
      continue;
    }
    const targetPath = join(target, name);
    if (existsSync(targetPath) && readFileSync(targetPath).equals(readFileSync(join(from, name)))) {
      same += 1;
      files.push({ name, action: 'skip-same' });
      continue;
    }
    copyFileSync(join(from, name), targetPath);
    fresh += 1;
    files.push({ name, action: 'copy' });
  }
  return { from, target, fresh, same, files };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
  const result = sync(ROOT);
  if (!result) {
    console.log('artefakte/mockups/bilder fehlt, die eingecheckten Bilder bleiben');
    process.exit(0);
  }
  console.log(`Boards: ${result.fresh} neu, ${result.same} unverändert, Quelle ${result.from}`);
}
