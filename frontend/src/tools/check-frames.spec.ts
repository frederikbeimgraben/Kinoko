import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findViolations } from '../../tools/check-frames.mjs';

/** Legt eine Datei unter `src/app/<folder>/<name>` an und gibt die Wurzel. */
function fixture(folder: string, name: string, source: string): string {
  const root = mkdtempSync(join(tmpdir(), 'check-frames-'));
  mkdirSync(join(root, 'src', 'app', ...folder.split('/')), { recursive: true });
  writeFileSync(join(root, 'src', 'app', ...folder.split('/'), name), source, 'utf8');
  return root;
}

function run(folder: string, name: string, source: string): ReturnType<typeof findViolations> {
  const root = fixture(folder, name, source);
  try {
    return findViolations(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('check-frames', () => {
  it('meldet eine eigene Dialogrolle in einer Seite', () => {
    const found = run('features/karte', 'karte.component.html', '<section role="dialog"></section>\n');

    expect(found).toHaveLength(1);
    expect(found[0].rule).toBe('dialog');
    expect(found[0].path).toBe('src/app/features/karte/karte.component.html');
  });

  it('meldet ein eigenes aria-modal', () => {
    const found = run('features/karte', 'karte.component.html', '<div aria-modal="true"></div>\n');

    expect(found.map((one) => one.rule)).toEqual(['aria-modal']);
  });

  it('meldet eine eigene Abdunkelung', () => {
    const found = run('features/karte', 'karte.component.scss', '.karte__scrim {\n  inset: 0;\n}\n');

    expect(found.map((one) => one.rule)).toEqual(['scrim']);
  });

  it('meldet einen eigenen Blattgriff', () => {
    const found = run('features/karte', 'karte.component.html', '<span class="karte__handle"></span>\n');

    expect(found.map((one) => one.rule)).toEqual(['griff']);
  });

  it('lässt die Eigenschaft durch, die einen Rahmen nur einstellt', () => {
    const found = run('features/karte', 'karte.component.scss', ':host {\n  --pilz-scrim: red;\n}\n');

    expect(found).toEqual([]);
  });

  it('lässt den Rahmen-Baustein selbst durch', () => {
    const found = run('ui/sheet', 'sheet.component.html', '<section role="dialog" aria-modal="true">\n');

    expect(found).toEqual([]);
  });

  it('lässt einen Test durch, der einen Rahmen nur prüft', () => {
    const found = run('features/karte', 'karte.component.spec.ts', "query('.karte__scrim');\n");

    expect(found).toEqual([]);
  });
});
