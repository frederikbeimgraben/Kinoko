import { AERIAL_STYLE, TOPO_STYLE, darkGround, styleFor } from './background';

describe('background', () => {
  it('gives the raster styles for the terrain and the satellite image', () => {
    expect(styleFor('topo', 'hell')).toBe(TOPO_STYLE);
    expect(styleFor('satellite', 'dunkel')).toBe(AERIAL_STYLE);
    expect(styleFor('map', 'dunkel')).toContain('/styles/dark');
  });

  it('knows which ground is dark', () => {
    expect(darkGround('map', 'dunkel')).toBe(true);
    expect(darkGround('map', 'hell')).toBe(false);
    expect(darkGround('dark', 'hell')).toBe(true);
    expect(darkGround('light', 'dunkel')).toBe(false);
    expect(darkGround('satellite', 'hell')).toBe(true);
    expect(darkGround('topo', 'dunkel')).toBe(false);
  });
});
