#!/usr/bin/env node
/**
 * Sucht deutschen Text ausserhalb von i18n.
 * Text für Personen kommt über `| t`, nicht fest im Code (CLAUDE.md).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP_ROOT = join(ROOT, 'src', 'app');
const ALLOW_PATH = join(ROOT, 'tools', 'lint-allow.json');
const WRITE_ALLOW = process.argv.includes('--write-allow');
const EXCLUDED_ZONES = ['core/i18n', 'testing'];

const UMLAUT = /[äöüÄÖÜß]/;
const FUNCTION_WORDS = new Set([
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'einer',
  'eines',
  'und',
  'oder',
  'nicht',
  'kein',
  'keine',
  'mit',
  'ohne',
  'für',
  'von',
  'zu',
  'auf',
  'aus',
  'bei',
  'noch',
  'nur',
  'wird',
  'werden',
  'ist',
  'sind',
  'hat',
  'haben',
]);

/** Erkennt deutschen Text: Umlaut oder ein Funktionswort als eigenes Wort. */
function isGerman(text) {
  const letters = text.match(/[A-Za-zÄÖÜäöüß]/g) ?? [];
  if (letters.length < 2) return false;
  if (UMLAUT.test(text)) return true;
  const words = text.match(/[A-Za-zÄÖÜäöüß]+/g) ?? [];
  return words.some((w) => FUNCTION_WORDS.has(w.toLowerCase()));
}

function lineAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (source[i] === '\n') line += 1;
  return line;
}

/** Sammelt String-Literale ausserhalb von Kommentaren. */
function stringsInTs(source) {
  const found = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      i = end === -1 ? source.length : end;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      const start = i;
      let j = i + 1;
      while (j < source.length && source[j] !== quote) j += source[j] === '\\' ? 2 : 1;
      found.push({ text: source.slice(start + 1, j), line: lineAt(source, start) });
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return found;
}

/** Sammelt Textknoten ausserhalb von Tags, Kommentaren und Ausdrücken. */
function textNodesInHtml(source) {
  const found = [];
  let i = 0;
  let mode = 'text';
  let buf = '';
  let bufStart = 0;
  const flush = () => {
    if (buf.trim().length > 0) found.push({ text: buf, line: lineAt(source, bufStart) });
    buf = '';
  };
  while (i < source.length) {
    if (mode === 'text') {
      if (source.startsWith('<!--', i)) {
        flush();
        const end = source.indexOf('-->', i);
        i = end === -1 ? source.length : end + 3;
        continue;
      }
      if (source[i] === '<') {
        flush();
        mode = 'tag';
        i += 1;
        continue;
      }
      if (source.startsWith('{{', i)) {
        flush();
        mode = 'expr';
        i += 2;
        continue;
      }
      if (buf === '') bufStart = i;
      buf += source[i];
      i += 1;
      continue;
    }
    if (mode === 'tag') {
      if (source[i] === '>') mode = 'text';
      i += 1;
      continue;
    }
    if (source.startsWith('}}', i)) {
      mode = 'text';
      i += 2;
      continue;
    }
    i += 1;
  }
  flush();
  return found;
}

function collectFiles(folder, found) {
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) {
      const relPath = relative(APP_ROOT, path);
      if (EXCLUDED_ZONES.some((zone) => relPath === zone || relPath.startsWith(zone + sep))) continue;
      collectFiles(path, found);
      continue;
    }
    if (name.endsWith('.spec.ts')) continue;
    if (name.endsWith('.ts') || name.endsWith('.html')) found.push(path);
  }
  return found;
}

function allViolations() {
  const found = [];
  for (const file of collectFiles(APP_ROOT, [])) {
    const source = readFileSync(file, 'utf8');
    const path = relative(ROOT, file);
    const candidates = file.endsWith('.html') ? textNodesInHtml(source) : stringsInTs(source);
    for (const c of candidates) {
      if (isGerman(c.text)) found.push({ path, line: c.line, text: c.text.trim().slice(0, 60) });
    }
  }
  return found;
}

/** Der Schlüssel hängt am Text, nicht an der Zeile: eine Verschiebung zählt nicht. */
function allowKey(v) {
  const text = v.text.replace(/\s+/g, ' ').trim();
  return `${v.path}#${createHash('sha256').update(text).digest('hex').slice(0, 8)}`;
}

function readAllow() {
  try {
    return JSON.parse(readFileSync(ALLOW_PATH, 'utf8'));
  } catch {
    return {};
  }
}

const violations = allViolations();
const keys = [...new Set(violations.map(allowKey))].sort();

if (WRITE_ALLOW) {
  const allow = readAllow();
  allow.german = keys;
  const { writeFileSync } = await import('node:fs');
  writeFileSync(ALLOW_PATH, JSON.stringify(allow, null, 2) + '\n');
  console.log(`${keys.length} Ausnahmen für german geschrieben.`);
  process.exit(0);
}

const allowed = new Set(readAllow().german ?? []);
const reported = violations.filter((v) => !allowed.has(allowKey(v)));

for (const v of reported) console.log(`${v.path}:${v.line}  german  „${v.text}“`);
if (reported.length > 0) {
  console.error(`Neue deutsche Texte: ${reported.length}.`);
  process.exit(1);
}
console.log('Keine neuen deutschen Texte.');
