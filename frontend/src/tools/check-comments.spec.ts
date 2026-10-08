import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allowKey, report } from '../../tools/check-comments.mjs';

/** Makes one source file under `src/app`, with empty `e2e` and `tools` folders. */
function fixture(source: string): { root: string; allowPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'check-comments-'));
  mkdirSync(join(root, 'src', 'app'), { recursive: true });
  mkdirSync(join(root, 'e2e'), { recursive: true });
  mkdirSync(join(root, 'tools'), { recursive: true });
  writeFileSync(join(root, 'src', 'app', 'a.ts'), source, 'utf8');
  return { root, allowPath: join(root, 'lint-allow.json') };
}

function reasons(source: string): string[] {
  const { root, allowPath } = fixture(source);
  try {
    return report(root, allowPath).map((v) => v.reason);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const THREE_LINES = 'export const x = 1;\n// one\n// two\n// three\nexport const y = 2;\n';

describe('check-comments', () => {
  it('reports a violation with its path and reason', () => {
    const { root, allowPath } = fixture(THREE_LINES);
    try {
      const found = report(root, allowPath);

      expect(found).toHaveLength(1);
      expect(found[0].path).toBe('src/app/a.ts');
      expect(found[0].reason).toContain('lines in sequence');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('skips a violation in the exception list', () => {
    const { root, allowPath } = fixture(THREE_LINES);
    try {
      const [violation] = report(root, allowPath);
      writeFileSync(allowPath, JSON.stringify({ comments: [allowKey(violation)] }));

      expect(report(root, allowPath)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts a correct comment', () => {
    expect(reasons('export const x = 1; // the default size\n')).toEqual([]);
  });

  it('reports a German comment', () => {
    expect(reasons('export const x = 1; // die Größe der Karte\n')).toEqual([
      'German comment, write ASD-STE100 English',
    ]);
  });

  it('accepts a quoted German label in an English comment', () => {
    expect(reasons('export const x = 1; // shows „Arten“ in the header\n')).toEqual([]);
  });

  it('reports a history word', () => {
    expect(reasons('export const x = 1; // this was previously a list\n')).toEqual([
      'history word "previously"',
    ]);
  });
});
