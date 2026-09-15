import { STANDARD_COLOURS, distance, nearestColour, nearestTones, oklab } from './standard-colours';

describe('nearestColour', () => {
  it('trifft jede Standardfarbe genau', () => {
    for (const colour of STANDARD_COLOURS) {
      expect(nearestColour(colour.hex).key).toBe(colour.key);
    }
  });

  it('ordnet die Töne des Katalogs der nächsten Standardfarbe zu', () => {
    expect(nearestColour('#6b4423').key).toBe('brown');
    expect(nearestColour('#e8d9b5').key).toBe('cream');
    expect(nearestColour('#3e2a17').key).toBe('darkBrown');
  });

  it('trennt zwei nahe Brauntöne über die Helligkeit', () => {
    expect(nearestColour('#6d4626').key).toBe('brown');
    expect(nearestColour('#402c19').key).toBe('darkBrown');
  });
});

describe('distance', () => {
  it('ist null zu sich selbst und wächst mit dem Abstand', () => {
    expect(distance('#6b4423', '#6b4423')).toBe(0);
    expect(distance('#6b4423', '#6d4626')).toBeLessThan(distance('#6b4423', '#f3efe6'));
  });

  it('rechnet Weiß auf die hellste Stelle des Oklab-Raums', () => {
    const [light] = oklab('#ffffff');
    expect(light).toBeCloseTo(1, 2);
  });
});

describe('nearestTones', () => {
  it('gibt höchstens n Töne und hält die Folge des Katalogs', () => {
    const tones = ['#f3efe6', '#6b4423', '#3e2a17', '#e8d9b5'];

    expect(nearestTones(tones, '#3e2a17', 2)).toEqual(['#6b4423', '#3e2a17']);
  });

  it('nimmt jeden Ton nur einmal und gibt nie mehr, als es gibt', () => {
    const tones = ['#6b4423', '#6b4423', '#e8d9b5'];

    expect(nearestTones(tones, '#6b4423', 6)).toEqual(['#6b4423', '#e8d9b5']);
  });

  it('bleibt ohne Ton leer', () => {
    expect(nearestTones([], '#6b4423', 6)).toEqual([]);
  });
});
