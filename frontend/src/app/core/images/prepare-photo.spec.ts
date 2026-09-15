import { describe, expect, it } from 'vitest';
import { jpegName, targetSize, MAX_EDGE } from './prepare-photo';

describe('targetSize', () => {
  it('lässt ein kleines Bild, wie es ist', () => {
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('bringt die längste Kante auf die Grenze', () => {
    expect(targetSize(4000, 3000)).toEqual({ width: MAX_EDGE, height: 1200 });
  });

  it('rechnet auch hochkant', () => {
    expect(targetSize(3000, 4000)).toEqual({ width: 1200, height: MAX_EDGE });
  });

  it('bleibt bei einer Kante ohne Maß stehen', () => {
    expect(targetSize(0, 0)).toEqual({ width: 0, height: 0 });
  });
});

describe('jpegName', () => {
  it('tauscht die Endung', () => {
    expect(jpegName('IMG_0042.HEIC')).toBe('IMG_0042.jpg');
  });

  it('hängt die Endung an, wo keine steht', () => {
    expect(jpegName('foto')).toBe('foto.jpg');
  });
});
