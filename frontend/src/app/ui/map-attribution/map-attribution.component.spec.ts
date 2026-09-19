import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { MapAttributionComponent } from './map-attribution.component';

describe('MapAttributionComponent', () => {
  it('nennt ohne Vermerk nur die Grundkarte', async () => {
    const { container } = await render(MapAttributionComponent, { inputs: {} });

    expect(screen.getByText('© OpenStreetMap')).toBeInTheDocument();
    await noViolations(container);
  });

  it('hängt den Vermerk einer Ebene mit Quellenpflicht an', async () => {
    await render(MapAttributionComponent, { inputs: { note: 'Thünen-Institut, CC BY 4.0' } });

    expect(screen.getByText('© OpenStreetMap · Thünen-Institut, CC BY 4.0')).toBeInTheDocument();
  });
});
