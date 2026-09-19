import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtures, sizeOf } from '../../tools/render-fixtures.mjs';

const PAGE =
  '<helmet></helmet>\n<div style="position:relative;width:390px;height:631px;overflow:hidden"></div>';

describe('render-fixtures', () => {
  it('liest Breite und Höhe aus der Seite', () => {
    expect(sizeOf(PAGE)).toEqual({ width: 390, height: 631 });
  });

  it('lässt eine Seite ohne Fläche weg', () => {
    expect(sizeOf('<helmet></helmet>\n<div></div>')).toBeNull();
  });

  it('nennt jede Fixtur mit Namen und Größe', () => {
    const dir = mkdtempSync(join(tmpdir(), 'render-fixtures-'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'map-stein-631.html'), PAGE, 'utf8');
    writeFileSync(join(dir, 'map-stein-631.png'), 'kein Bild', 'utf8');
    writeFileSync(join(dir, 'ohne-flaeche.html'), '<helmet></helmet>\n<div></div>', 'utf8');
    try {
      const found = fixtures(dir);

      expect(found).toHaveLength(1);
      expect(found[0].stem).toBe('map-stein-631');
      expect(found[0].size).toEqual({ width: 390, height: 631 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
