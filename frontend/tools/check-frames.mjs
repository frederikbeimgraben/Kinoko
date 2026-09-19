#!/usr/bin/env node
/** Prüft, dass nur die Rahmen-Bausteine einen Rahmen bauen. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Die Regeln, ihr Muster und die Ordner, die sie tragen dürfen. */
const RULES = [
  {
    name: 'dialog',
    pattern: /role\s*[=:]\s*['"](?:dialog|alertdialog)['"]/g,
    owners: ['ui/sheet', 'ui/modal-layer'],
  },
  { name: 'aria-modal', pattern: /aria-modal/g, owners: ['ui/sheet', 'ui/modal-layer'] },
  {
    name: 'scrim',
    pattern: /[-\w]*(?:scrim|backdrop)[-\w]*/g,
    owners: [
      'ui/sheet',
      'ui/overlay-host',
      'ui/modal-layer',
      'ui/popover',
      'ui/confirm-dialog',
      'ui/photo-dialog',
      'ui/object-menu',
      'ui/reject-dialog',
    ],
  },
  {
    name: 'griff',
    pattern: /[-\w]*__handle[-\w]*|handle-line/g,
    // `ui/reject-dialog` trägt den Griff aus dem Board `ImageReject`. Das
    // Blatt geht mit dem Bilder-Paket auf `ui/sheet` über.
    owners: ['ui/sheet', 'ui/reject-dialog'],
  },
];

/** Eine Eigenschaft wie `--pilz-scrim` stellt einen Rahmen ein, sie baut keinen. */
function isCustomProperty(text) {
  return text.startsWith('--');
}

function walk(folder, found) {
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) {
      walk(path, found);
      continue;
    }
    if (/\.(html|scss|ts)$/.test(name) && !name.endsWith('.spec.ts')) found.push(path);
  }
  return found;
}

/** Jeder Rahmen, den eine Datei außerhalb der Bausteine selbst baut. */
export function findViolations(root) {
  const base = join(root, 'src', 'app');
  const found = [];
  for (const path of walk(base, [])) {
    const place = relative(base, path).split(sep).join('/');
    const folder = place.slice(0, place.lastIndexOf('/'));
    const source = readFileSync(path, 'utf8');
    const lines = source.split('\n');
    for (const rule of RULES) {
      if (rule.owners.includes(folder)) continue;
      lines.forEach((line, index) => {
        for (const [text] of line.matchAll(rule.pattern)) {
          if (isCustomProperty(text)) continue;
          found.push({
            path: `src/app/${place}`,
            line: index + 1,
            rule: rule.name,
            text: text.trim(),
          });
        }
      });
    }
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const found = findViolations(ROOT);
  for (const v of found) console.error(`${v.path}:${v.line}  ${v.rule}  ${v.text}`);
  if (found.length > 0) {
    console.error(`${found.length} eigene Rahmen außerhalb der Bausteine.`);
    process.exit(1);
  }
  console.log('Jeder Rahmen kommt aus einem Baustein.');
}
