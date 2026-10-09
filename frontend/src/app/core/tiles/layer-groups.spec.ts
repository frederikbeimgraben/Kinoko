import { layerGroup, layerIcon } from './layer-groups';

describe('layer groups', () => {
  it('gives each known layer its group', () => {
    expect(layerGroup('regen_4w')).toBe('precipitation');
    expect(layerGroup('fichte')).toBe('forest');
    expect(layerGroup('unbekannt')).toBeNull();
  });

  it('shows a tree for a forest layer, not the diagram of the taxonomy', () => {
    expect(layerIcon('fichte')).toBe('forest');
    expect(layerIcon('wald')).toBe('forest');
    expect(layerIcon('temperatur')).toBe('thermometer');
    expect(layerIcon('unbekannt')).toBeNull();
  });
});
