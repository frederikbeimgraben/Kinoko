import { TestBed } from '@angular/core/testing';
import { MapState, SAVE_DELAY, STORAGE_KEY, DEFAULT_SPECIES, DEFAULT_LAYER } from './map.state';

/** Was nach der Drosselung im Speicher steht. */
function stored(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
}

describe('MapState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('beginnt beim Steinpilz, der aktuellen Woche und der Vorhersage', () => {
    const state = TestBed.inject(MapState);

    expect(DEFAULT_SPECIES).toBe('boletus-edulis');
    expect(DEFAULT_LAYER).toBe('regen_4w');
    expect(state.species()).toBe('boletus-edulis');
    expect(state.week()).toBeNull();
    expect(state.view()).toBe('forecast');
    expect(state.opacity()).toBe(1);
    expect(state.detent()).toBe(1);
    expect(state.background()).toBe('map');
  });

  it('sichert den Stand nach der Drosselung', async () => {
    vi.useFakeTimers();
    const state = TestBed.inject(MapState);
    state.species.set('cantharellus-cibarius');
    state.week.set('2025-40');
    state.view.set('layer');
    state.detent.set(0);
    TestBed.tick();

    await vi.advanceTimersByTimeAsync(SAVE_DELAY);

    expect(stored()['species']).toBe('cantharellus-cibarius');
    expect(stored()['week']).toBe('2025-40');
    expect(stored()['view']).toBe('layer');
    expect(stored()['detent']).toBe(0);
    vi.useRealTimers();
  });

  it('liest einen gesicherten Stand und verwirft Unsinn', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        species: 'imleria-badia',
        week: 'kaputt',
        view: 'ebene',
        layer: 'regen_4w',
        opacity: 0.4,
        background: 'light',
        forecastBelow: true,
        showMarkers: false,
        showZones: false,
        showSharedFinds: false,
        detent: 2,
      }),
    );

    const state = TestBed.inject(MapState);

    expect(state.species()).toBe('imleria-badia');
    expect(state.week()).toBeNull();
    expect(state.view()).toBe('forecast');
    expect(state.layer()).toBe('regen_4w');
    expect(state.opacity()).toBeCloseTo(0.4);
    expect(state.background()).toBe('light');
    expect(state.forecastBelow()).toBe(true);
    expect(state.showMarkers()).toBe(false);
    expect(state.showZones()).toBe(false);
    expect(state.showSharedFinds()).toBe(false);
    expect(state.detent()).toBe(2);
  });

  it('nimmt einen unlesbaren Stand nicht an', () => {
    localStorage.setItem(STORAGE_KEY, '{kaputt');

    expect(TestBed.inject(MapState).species()).toBe(DEFAULT_SPECIES);
  });

  it('nimmt nur einen Hintergrund an, den es gibt', () => {
    const state = TestBed.inject(MapState);

    state.setBackground('topo');
    expect(state.background()).toBe('map');

    state.setBackground('light');
    expect(state.background()).toBe('light');
  });
});

describe('MapState mit Unsinn im Speicher', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('verwirft jeden Wert in falscher Form', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        species: 42,
        week: 7,
        view: true,
        layer: 'KAPUTT',
        opacity: 'viel',
        background: 5,
        forecastBelow: 'ja',
        showMarkers: 1,
        showZones: 'nein',
        showSharedFinds: null,
        detent: 9,
      }),
    );

    const state = TestBed.inject(MapState);

    expect(state.species()).toBe(DEFAULT_SPECIES);
    expect(state.week()).toBeNull();
    expect(state.view()).toBe('forecast');
    expect(state.layer()).toBeNull();
    expect(state.opacity()).toBe(1);
    expect(state.background()).toBe('map');
    expect(state.forecastBelow()).toBe(false);
    expect(state.showMarkers()).toBe(true);
    expect(state.showZones()).toBe(true);
    expect(state.showSharedFinds()).toBe(true);
    expect(state.detent()).toBe(1);
  });

  it('nimmt einen leeren Wert nicht an', () => {
    localStorage.setItem(STORAGE_KEY, 'null');

    expect(TestBed.inject(MapState).species()).toBe(DEFAULT_SPECIES);
  });

  it('übersteht einen gesperrten Speicher', async () => {
    vi.useFakeTimers();
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('voll');
    });
    const state = TestBed.inject(MapState);
    state.species.set('cantharellus-cibarius');
    TestBed.tick();

    await vi.advanceTimersByTimeAsync(SAVE_DELAY);

    expect(write).toHaveBeenCalled();
    write.mockRestore();
    vi.useRealTimers();
  });
});
