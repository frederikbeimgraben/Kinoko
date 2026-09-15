import { LAYERS_MANIFEST, tilePath, manifestPath } from './tile-paths';

describe('Kachelpfade', () => {
  it('fragt das Manifest unter dem Slug der Art', () => {
    expect(manifestPath('boletus-edulis')).toBe('/boletus-edulis.json');
  });

  it('baut die Kachel nach dem Muster des Renderings', () => {
    expect(tilePath('boletus_edulis_kacheln/2026W07', 9, 271, 176)).toBe(
      '/boletus_edulis_kacheln/2026W07/9/271/176.png',
    );
    expect(LAYERS_MANIFEST).toBe('/layers.json');
  });
});
