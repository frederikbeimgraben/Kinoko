import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allowKey, report } from '../../tools/check-german.mjs';

/** Legt eine Quelldatei unter `src/app` an. */
function fixture(source: string): { root: string; allowPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'check-german-'));
  mkdirSync(join(root, 'src', 'app'), { recursive: true });
  writeFileSync(join(root, 'src', 'app', 'a.ts'), source, 'utf8');
  return { root, allowPath: join(root, 'lint-allow.json') };
}

describe('check-german', () => {
  it('meldet einen Verstoss mit Pfad und Grund', () => {
    const { root, allowPath } = fixture("export const message = 'für alle';\n");
    try {
      const found = report(root, allowPath);

      expect(found).toHaveLength(1);
      expect(found[0].path).toBe('src/app/a.ts');
      expect(found[0].text).toContain('für alle');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('lässt einen Verstoss aus der Ausnahmeliste weg', () => {
    const { root, allowPath } = fixture("export const message = 'für alle';\n");
    try {
      const [violation] = report(root, allowPath);
      writeFileSync(allowPath, JSON.stringify({ german: [allowKey(violation)] }));

      expect(report(root, allowPath)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('läuft ohne Verstoss durch', () => {
    const { root, allowPath } = fixture("export const message = 'hello world';\n");
    try {
      expect(report(root, allowPath)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
