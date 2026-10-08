import { render } from '@testing-library/angular';
import { readLayers, type Layer } from '../../core/tiles/layers';
import { RAW_LAYERS } from '../../testing/map-doubles';
import { CombinationComponent } from './combination.component';
import type { Factor } from './factors';

const LAYERS = readLayers(RAW_LAYERS).layers;
const SOURCES = new Map<string, Layer>(LAYERS.map((layer) => [layer.id, layer]));
const FACTORS: Factor[] = [{ source: LAYERS[0].id, condition: 'above', low: 0.2, high: 1, active: true }];

describe('CombinationComponent', () => {
  it('shows one row for each factor', async () => {
    const { container } = await render(CombinationComponent, {
      inputs: { factors: FACTORS, sources: SOURCES },
    });

    expect(container.querySelectorAll('app-factor-row')).toHaveLength(1);
  });

  it('puts the factors and the add row into one group', async () => {
    const { container } = await render(CombinationComponent, {
      inputs: { factors: FACTORS, sources: SOURCES },
    });

    expect(
      container.querySelectorAll('app-row-group app-factor-row, app-row-group app-add-row'),
    ).toHaveLength(2);
  });
});
