import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sync } from '../../tools/sync-boards.mjs';

/** Legt die Quelle `artefakte/mockups/bilder` unter einem frischen Wurzelordner an. */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'sync-boards-'));
  mkdirSync(join(root, 'artefakte', 'mockups', 'bilder'), { recursive: true });
  return root;
}

describe('sync-boards', () => {
  it('meldet einen veralteten Stand mit Name und Grund', () => {
    const root = fixture();
    try {
      writeFileSync(join(root, 'artefakte', 'mockups', 'bilder', 'foo.png'), 'A');

      const result = sync(root);

      expect(result?.fresh).toBe(1);
      expect(result?.files).toContainEqual({ name: 'foo.png', action: 'copy' });
      expect(readFileSync(join(root, 'e2e', 'boards', 'baseline', 'foo.png'), 'utf8')).toBe('A');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('lässt ein Bild aus der Ausnahmeliste unverändert', () => {
    const root = fixture();
    try {
      writeFileSync(join(root, 'artefakte', 'mockups', 'bilder', 'Blocks.png'), 'A');
      mkdirSync(join(root, 'e2e', 'boards', 'baseline'), { recursive: true });
      writeFileSync(join(root, 'e2e', 'boards', 'baseline', 'Blocks.png'), 'B');

      const result = sync(root);

      expect(result?.fresh).toBe(0);
      expect(result?.files).toContainEqual({ name: 'Blocks.png', action: 'skip-excluded' });
      expect(readFileSync(join(root, 'e2e', 'boards', 'baseline', 'Blocks.png'), 'utf8')).toBe('B');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('spiegelt auch die Kartenbilder der Boards', () => {
    const root = fixture();
    try {
      mkdirSync(join(root, 'artefakte', 'mockups', 'code', 'fixtures'), { recursive: true });
      writeFileSync(join(root, 'artefakte', 'mockups', 'code', 'fixtures', 'map-stein.png'), 'A');

      const result = sync(root);

      expect(result?.fixtures.fresh).toBe(1);
      expect(readFileSync(join(root, 'e2e', 'boards', 'fixtures', 'map-stein.png'), 'utf8')).toBe('A');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('kommt ohne Kartenbilder aus', () => {
    const root = fixture();
    try {
      writeFileSync(join(root, 'artefakte', 'mockups', 'bilder', 'foo.png'), 'A');

      const result = sync(root);

      expect(result?.fixtureSource).toBeNull();
      expect(result?.fixtures.fresh).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('läuft ohne veralteten Stand durch', () => {
    const root = fixture();
    try {
      writeFileSync(join(root, 'artefakte', 'mockups', 'bilder', 'foo.png'), 'A');
      mkdirSync(join(root, 'e2e', 'boards', 'baseline'), { recursive: true });
      writeFileSync(join(root, 'e2e', 'boards', 'baseline', 'foo.png'), 'A');

      const result = sync(root);

      expect(result?.fresh).toBe(0);
      expect(result?.same).toBe(1);
      expect(existsSync(join(root, 'e2e', 'boards', 'baseline', 'foo.png'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
