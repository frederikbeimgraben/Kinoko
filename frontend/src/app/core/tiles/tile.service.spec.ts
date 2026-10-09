import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ConfigStore } from '../config/config.store';
import { TileService } from './tile.service';

function reply(data: unknown, ok = true): Response {
  return ok
    ? new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } })
    : new Response(null, { status: 404 });
}

/** The app page, as an origin without the file sends it with status 200. */
function page(): Response {
  return new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });
}

function service(origin = ''): TileService {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { configuration: () => ({ origin }) } },
    ],
  });
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

  it('meldet jeden Fehlschlag, bis ein neuer Versuch gelingt', async () => {
    const fetcher = vi.fn((): Promise<Response> => Promise.reject(new Error('kein Netz')));
    vi.stubGlobal('fetch', fetcher);
    const tiles = service();

    await Promise.all([tiles.loadLayers(), tiles.load('boletus-edulis')]);
    expect(tiles.layersFailed()).toBe(true);
    expect(tiles.failed().has('boletus-edulis')).toBe(true);
    expect(tiles.missing().size).toBe(0);

    fetcher.mockResolvedValue(reply({ top: 1 }));
    await tiles.load('boletus-edulis');
    expect(tiles.failed().has('boletus-edulis')).toBe(false);

    tiles.forget();
    expect(tiles.layersFailed()).toBe(false);
  });

  it('meldet 404 und die Seite der App gleich: das Manifest fehlt', async () => {
    const fetcher = vi.fn((path: string) =>
      Promise.resolve(path === '/layers.json' ? page() : reply(null, false)),
    );
    vi.stubGlobal('fetch', fetcher);
    const tiles = service();

    await Promise.all([tiles.loadLayers(), tiles.load('boletus-edulis')]);

    expect(tiles.layersMissing()).toBe(true);
    expect(tiles.missing().has('boletus-edulis')).toBe(true);
    expect(tiles.layersFailed()).toBe(false);
    expect(tiles.failed().size).toBe(0);
    expect(tiles.layers()).toBeNull();
    expect(tiles.manifestOf('boletus-edulis')).toBeNull();

    tiles.forget();
    expect(tiles.layersMissing()).toBe(false);
    expect(tiles.missing().size).toBe(0);
  });

  it('fragt nach einem fehlenden Manifest beim nächsten Aufruf wieder', async () => {
    const fetcher = vi.fn(() => Promise.resolve(page()));
    vi.stubGlobal('fetch', fetcher);
    const tiles = service();

    await tiles.load('boletus-edulis');
    fetcher.mockResolvedValue(reply({ top: 0.25 }));
    await tiles.load('boletus-edulis');

    expect(tiles.manifestOf('boletus-edulis')?.top).toBe(0.25);
    expect(tiles.missing().has('boletus-edulis')).toBe(false);
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
