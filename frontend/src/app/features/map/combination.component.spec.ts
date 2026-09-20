import { render } from '@testing-library/angular';
import { readLayers, type Layer } from '../../core/tiles/layers';
import { RAW_LAYERS } from '../../testing/map-doubles';
import { CombinationComponent } from './combination.component';
import type { Factor } from './factors';

const LAYERS = readLayers(RAW_LAYERS).layers;
const SOURCES = new Map<string, Layer>(LAYERS.map((layer) => [layer.id, layer]));
const FACTORS: Factor[] = [{ source: LAYERS[0].id, condition: 'above', low: 0.2, high: 1, active: true }];

describe('CombinationComponent', () => {
  it('zeigt je Faktor eine Zeile', async () => {
    const { container } = await render(CombinationComponent, {
      inputs: { factors: FACTORS, sources: SOURCES },
    });

    expect(container.querySelectorAll('app-factor-row')).toHaveLength(1);
  });

  it('blendet die Ränder der Faktoren aus', async () => {
    const { container } = await render(CombinationComponent, {
      inputs: { factors: FACTORS, sources: SOURCES },
    });

    expect(container.querySelectorAll('.combination__factors.scroll')).toHaveLength(1);
  });
});
