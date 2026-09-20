import { render } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { ZoneShapeComponent } from './zone-shape.component';

describe('ZoneShapeComponent', () => {
  it('zeichnet den Umriss ohne gestrichelte Kante und ohne Ecken', async () => {
    const { container } = await render(ZoneShapeComponent);

    const polygon = container.querySelector('polygon');
    expect(polygon).toHaveAttribute('stroke-dasharray', '0');
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    await noViolations(container);
  });

  it('zeichnet die Kante gestrichelt mit vier Eckpunkten, solange gezeichnet wird', async () => {
    const { container } = await render(ZoneShapeComponent, { inputs: { drawing: true } });

    const polygon = container.querySelector('polygon');
    expect(polygon).toHaveAttribute('stroke-dasharray', '6 4');
    expect(container.querySelectorAll('circle')).toHaveLength(4);
  });

  it('trägt die eigene Farbe als Füllung und Kante', async () => {
    const { container } = await render(ZoneShapeComponent, { inputs: { colour: '#4f8a3c' } });

    const polygon = container.querySelector('polygon');
    expect(polygon).toHaveAttribute('fill', '#4f8a3c');
    expect(polygon).toHaveAttribute('stroke', '#4f8a3c');
  });
});
