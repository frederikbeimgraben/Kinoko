import { covers, type Coverage } from './coverage';

function deckung(have: readonly string[], haveZoom: number): Coverage {
  return { existing: new Set(have), haveZoom };
}

describe('Kacheldeckung', () => {
  it('fragt die Liste, solange die Stufe aufgezählt ist', () => {
    const deckt = deckung(['8/137/87'], 8);
    expect(covers(deckt, 8, 137, 87)).toBe(true);
    expect(covers(deckt, 8, 137, 88)).toBe(false);
  });

  it('fragt über der Kappe die gröbere Kachel', () => {
    const deckt = deckung(['10/548/350'], 10);
    expect(covers(deckt, 14, 548 * 16, 350 * 16)).toBe(true);
    expect(covers(deckt, 14, 548 * 16 + 15, 350 * 16 + 15)).toBe(true);
    expect(covers(deckt, 12, 548 * 4, 350 * 4)).toBe(true);
  });

  it('deckt nichts, was auch die gröbere Kachel nicht deckt', () => {
    const deckt = deckung(['10/548/350'], 10);
    expect(covers(deckt, 14, 549 * 16, 350 * 16)).toBe(false);
  });

  it('bleibt bei einer Ebene ohne Kappe beim alten Verhalten', () => {
    const deckt = deckung(['5/16/10', '8/137/87'], 8);
    expect(covers(deckt, 5, 16, 10)).toBe(true);
    expect(covers(deckt, 6, 32, 20)).toBe(false);
  });
});
