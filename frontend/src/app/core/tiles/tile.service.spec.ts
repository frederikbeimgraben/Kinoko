import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ConfigService } from '../config/config.service';
import { TileService } from './tile.service';

function reply(data: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 404, json: () => Promise.resolve(data) } as Response;
}

function service(origin = ''): TileService {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const config = TestBed.inject(ConfigService) as unknown as {
    configuration: () => { origin: string } | null;
  };
  config.configuration = () => ({ origin });
  return TestBed.inject(TileService);
}

describe('TileService', () => {
  it('holt ein Manifest genau einmal je Art', async () => {
    const fetcher = vi.fn(() => Promise.resolve(reply({ top: 0.5 })));
    vi.stubGlobal('fetch', fetcher);
    const tiles = service();

    await Promise.all([tiles.load('boletus-edulis'), tiles.load('boletus-edulis')]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('/boletus-edulis.json');
    expect(tiles.manifestOf('boletus-edulis')?.top).toBe(0.5);
  });

  it('setzt den Ursprung aus der Konfiguration davor', () => {
    expect(service('https://pilze.example').url('/layers.json')).toBe('https://pilze.example/layers.json');
  });

  it('merkt sich einen Fehlschlag nicht', async () => {
    const fetcher = vi.fn(() => Promise.resolve(reply(null, false)));
    vi.stubGlobal('fetch', fetcher);
    const tiles = service();

    await tiles.loadLayers();
    expect(tiles.layers()).toBeNull();

    fetcher.mockResolvedValue(reply({ layers: { wald: { tiles: 'x' } } }));
    await tiles.loadLayers();
    expect(tiles.layerList()).toHaveLength(1);
  });

  it('vergisst auf Wunsch alles', async () => {
    const fetcher = vi.fn(() => Promise.resolve(reply({ top: 1 })));
    vi.stubGlobal('fetch', fetcher);
    const tiles = service();

    await tiles.load('a');
    tiles.forget();
    await tiles.load('a');

    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
