import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { report } from '../../tools/check-size.mjs';

/** Zeilen für eine Datei in `features/`, über oder unter der Grenze von 250. */
function lines(count: number): string {
  return `${Array.from({ length: count }, () => 'const x = 1;').join('\n')}\n`;
}

/** Legt eine Komponentendatei unter `src/app/features` an. */
function fixture(content: string): { root: string; allowPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'check-size-'));
  mkdirSync(join(root, 'src', 'app', 'features'), { recursive: true });
  writeFileSync(join(root, 'src', 'app', 'features', 'foo.component.ts'), content, 'utf8');
  return { root, allowPath: join(root, 'lint-allow.json') };
}

describe('check-size', () => {
  it('meldet einen Verstoss mit Pfad und Grund', () => {
    const { root, allowPath } = fixture(lines(260));
    try {
      const found = report(root, allowPath);

      expect(found).toHaveLength(1);
      expect(found[0].path).toBe('src/app/features/foo.component.ts');
      expect(found[0].limit).toBe(250);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('lässt einen Verstoss aus der Ausnahmeliste weg', () => {
    const { root, allowPath } = fixture(lines(260));
    try {
      const [violation] = report(root, allowPath);
      writeFileSync(allowPath, JSON.stringify({ size: [violation.path] }));

      expect(report(root, allowPath)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('läuft ohne Verstoss durch', () => {
    const { root, allowPath } = fixture(lines(5));
    try {
      expect(report(root, allowPath)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
