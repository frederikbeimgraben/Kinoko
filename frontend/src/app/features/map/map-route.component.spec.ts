import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { MapRouteComponent } from './map-route.component';

describe('KartenRouteComponent', () => {
  it('bleibt leer, weil die Karte in der Hülle hängt', async () => {
    await render(MapRouteComponent, { providers: [provideRouter([])] });

    expect(screen.queryByRole('region', { name: 'Karte von Deutschland' })).not.toBeInTheDocument();
  });
});
