#!/usr/bin/env node
/**
 * Prüft Kommentarregeln in `src` und `tools`.
 * Kommentare sagen Warum, nie Was.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const YEAR = /20\d{2}(?:-\d{2}-\d{2})?/;
const PR_NUMBER = /#\d+|\bPR\s*\d+\b/i;
const WORD_BOUNDARY = '(?<![A-Za-zÄÖÜäöüß])';
const WORD_BOUNDARY_END = '(?![A-Za-zÄÖÜäöüß])';
const FORBIDDEN_WORDS = new RegExp(
  `${WORD_BOUNDARY}(bis|frueher|früher|jetzt|seit)${WORD_BOUNDARY_END}`,
  'i',
);

/** Findet den Grund, warum ein Kommentartext verboten ist. */
function forbiddenReason(text) {
  if (YEAR.test(text)) return 'Jahreszahl oder Datum im Kommentar';
  if (PR_NUMBER.test(text)) return 'PR-Nummer im Kommentar';
  const word = FORBIDDEN_WORDS.exec(text);
  if (word) return `verbotenes Wort „${word[1]}“`;
  return null;
}

function lineAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (source[i] === '\n') line += 1;
  return line;
}

/** Zerlegt Quelltext in Zeilen- und Blockkommentare. Strings bleiben aussen vor. */
function scanCode(source) {
  const found = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < source.length && source[j] !== ch) j += source[j] === '\\' ? 2 : 1;
      i = j + 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      const before = source.slice(source.lastIndexOf('\n', i) + 1, i);
      found.push({
        type: 'line',
        standalone: before.trim() === '',
        line: lineAt(source, i),
        text: source.slice(i + 2, stop),
      });
      i = stop;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      const isDoc = source[i + 2] === '*' && source[i + 3] !== '/';
      found.push({
        type: isDoc ? 'doc' : 'block',
        line: lineAt(source, i),
        endLine: lineAt(source, stop),
        text: source.slice(i + (isDoc ? 3 : 2), stop - 2),
      });
      i = stop;
      continue;
    }
    i += 1;
  }
  return found;
}

/** Zerlegt eine Vorlage in `<!-- -->`-Kommentare. */
function scanHtml(source) {
  const found = [];
  const pattern = /<!--([\s\S]*?)-->/g;
  for (const match of source.matchAll(pattern)) {
    const start = match.index;
    const stop = start + match[0].length;
    found.push({ type: 'html', line: lineAt(source, start), endLine: lineAt(source, stop), text: match[1] });
  }
  return found;
}

/** Baut aus den Rohtreffern die Verstöße einer Datei. */
function violationsIn(path, comments) {
  const found = [];
  const lineRuns = [];
  let run = [];
  for (const comment of comments) {
    if (comment.type === 'line' && comment.standalone) {
      if (run.length > 0 && comment.line === run[run.length - 1] + 1) run.push(comment.line);
      else {
        if (run.length > 0) lineRuns.push(run);
        run = [comment.line];
      }
    } else if (run.length > 0) {
      lineRuns.push(run);
      run = [];
    }
  }
  if (run.length > 0) lineRuns.push(run);
  for (const r of lineRuns) {
    if (r.length > 2)
      found.push({
        line: r[0],
        rule: 'block',
        text: comments
          .filter((c) => r.includes(c.line))
          .map((c) => c.text)
          .join(' '),
        reason: `${r.length} zusammenhängende Zeilen`,
      });
  }
  for (const comment of comments) {
    const reason = forbiddenReason(comment.text);
    if (reason) found.push({ line: comment.line, rule: 'inhalt', text: comment.text, reason });
    if (comment.type === 'doc') {
      const span = comment.endLine - comment.line + 1;
      if (span > 3) {
        found.push({
          line: comment.line,
          rule: 'docstring',
          text: comment.text,
          reason: `${span} Zeilen, Grenze 3`,
        });
      }
    }
    if (comment.type === 'block' || comment.type === 'html') {
      const span = comment.endLine - comment.line + 1;
      if (span > 2) {
        found.push({
          line: comment.line,
          rule: 'block',
          text: comment.text,
          reason: `${span} Zeilen, Grenze 2`,
        });
      }
    }
  }
  return found.map((v) => ({ path, ...v }));
}

function collectFiles(folder, extensions, found) {
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) {
      collectFiles(path, extensions, found);
      continue;
    }
    if (extensions.some((ext) => name.endsWith(ext))) found.push(path);
  }
  return found;
}

/** Sucht Kommentarverstöße unter `root/src/app` und `root/tools`. */
export function findViolations(root) {
  const files = [
    ...collectFiles(join(root, 'src', 'app'), ['.ts', '.html', '.scss'], []),
    ...collectFiles(join(root, 'tools'), ['.mjs'], []),
  ];
  const found = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const path = relative(root, file);
    const comments = file.endsWith('.html') ? scanHtml(source) : scanCode(source);
    found.push(...violationsIn(path, comments));
  }
  return found;
}

/** Der Schlüssel hängt am Text, nicht an der Zeile. Eine Verschiebung zählt nicht. */
export function allowKey(v) {
  const text = `${v.rule} ${v.text}`.replace(/\s+/g, ' ').trim();
  return `${v.path}#${createHash('sha256').update(text).digest('hex').slice(0, 8)}`;
}

function readAllow(allowPath) {
  try {
    return JSON.parse(readFileSync(allowPath, 'utf8'));
  } catch {
    return {};
  }
}

/** Meldet Verstöße unter `root` ohne die in `allowPath` freigegebenen. */
export function report(root, allowPath) {
  const allowed = new Set(readAllow(allowPath).comments ?? []);
  return findViolations(root).filter((v) => !allowed.has(allowKey(v)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const ALLOW_PATH = join(ROOT, 'tools', 'lint-allow.json');

  if (process.argv.includes('--write-allow')) {
    const keys = [...new Set(findViolations(ROOT).map(allowKey))].sort();
    const allow = readAllow(ALLOW_PATH);
    allow.comments = keys;
    writeFileSync(ALLOW_PATH, JSON.stringify(allow, null, 2) + '\n');
    console.log(`${keys.length} Ausnahmen für comments geschrieben.`);
    process.exit(0);
  }

  const reported = report(ROOT, ALLOW_PATH);
  for (const v of reported) console.log(`${v.path}:${v.line}  ${v.rule}  ${v.reason}`);
  if (reported.length > 0) {
    console.error(`Neue Kommentarverstöße: ${reported.length}.`);
    process.exit(1);
  }
  console.log('Keine neuen Kommentarverstöße.');
}
