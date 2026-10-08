import { nearestDetent, releaseDetent, releaseVelocity, rubberBand } from './sheet-snap';

const SIZES = [152, 320, 720] as const;

describe('sheet-snap', () => {
  it('measures the speed over the last 80 ms only', () => {
    const samples = [
      { time: 0, height: 0 },
      { time: 100, height: 100 },
      { time: 150, height: 200 },
    ];

    expect(releaseVelocity(samples, 160)).toBe(2);
    expect(releaseVelocity(samples, 400)).toBe(0);
    expect(releaseVelocity([], 0)).toBe(0);
  });

  it('lets the sheet follow the finger below the top and resist above it', () => {
    expect(rubberBand(300, 400)).toBe(300);
    expect(rubberBand(500, 400)).toBe(430);
  });

  it('keeps the detent for a small movement and else takes the nearest', () => {
    expect(nearestDetent(SIZES, 1, 330)).toBe(1);
    expect(nearestDetent(SIZES, 1, 600)).toBe(2);
    expect(nearestDetent(SIZES, 1, 160)).toBe(0);
  });

  it('goes to the next detent in the direction of a fling', () => {
    expect(releaseDetent(SIZES, 0, 200, 1)).toBe(1);
    expect(releaseDetent(SIZES, 2, 650, -1)).toBe(1);
    expect(releaseDetent(SIZES, 1, 700, 1)).toBe(2);
  });

  it('goes to the top detent on a fling up above it', () => {
    expect(releaseDetent(SIZES, 1, 800, 2)).toBe(2);
  });

  it('gives null for a fling down below the lowest detent', () => {
    expect(releaseDetent(SIZES, 0, 100, -2)).toBeNull();
  });

  it('keeps the current detent when all sizes are the same', () => {
    expect(releaseDetent([400, 400, 400], 1, 380, 2)).toBe(1);
    expect(releaseDetent([400, 400, 400], 1, 390, 0)).toBe(1);
  });
});
