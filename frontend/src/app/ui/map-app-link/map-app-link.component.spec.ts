import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { ViewportService } from '../../core/layout/viewport.service';
import { MapAppService } from '../../core/maps/map-app.service';
import { MapAppLinkComponent } from './map-app-link.component';

const LOCATION: readonly [number, number] = [9.1829, 48.7758];

async function build(wide: boolean, choice: 'osm' | 'google' = 'osm'): Promise<Element> {
  const { container } = await render(MapAppLinkComponent, {
    inputs: { target: LOCATION },
    providers: [
      { provide: ViewportService, useValue: { wide: signal(wide) } },
      { provide: MapAppService, useValue: { choice: signal(choice) } },
    ],
  });
  return container;
}

describe('MapAppLinkComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('öffnet am Telefon den geo-Verweis', async () => {
    await build(false);
    const fakeLocation = { href: '' } as unknown as Location;
    vi.spyOn(window, 'location', 'get').mockReturnValue(fakeLocation);

    await userEvent.click(screen.getByRole('button', { name: 'In Karten-App öffnen' }));

    expect(fakeLocation.href).toBe('geo:48.775800,9.182900');
  });

  it('öffnet am Rechner OpenStreetMap, wenn nichts gewählt ist', async () => {
    await build(true, 'osm');
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    await userEvent.click(screen.getByRole('button', { name: 'In Karten-App öffnen' }));

    expect(open).toHaveBeenCalledWith(
      'https://www.openstreetmap.org/?mlat=48.775800&mlon=9.182900#map=17/48.775800/9.182900',
      '_blank',
      'noopener',
    );
  });

  it('öffnet am Rechner Google Maps, wenn das die Wahl ist', async () => {
    await build(true, 'google');
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    await userEvent.click(screen.getByRole('button', { name: 'In Karten-App öffnen' }));

    expect(open).toHaveBeenCalledWith(
      'https://www.google.com/maps/search/?api=1&query=48.775800%2C9.182900',
      '_blank',
      'noopener',
    );
  });

  it('bleibt ohne Befund', async () => {
    const container = await build(true);

    await noViolations(container);
  });
});
