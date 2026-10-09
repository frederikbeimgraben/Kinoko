import { TestBed } from '@angular/core/testing';
import { MapStore, SAVE_DELAY, STORAGE_KEY, DEFAULT_SPECIES, DEFAULT_LAYER } from './map.store';

/** The value in the storage after the debounce. */
function stored(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
}

describe('MapStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with the porcini, the current week and the forecast', () => {
    const state = TestBed.inject(MapStore);

    expect(DEFAULT_SPECIES).toBe('boletus-edulis');
    expect(DEFAULT_LAYER).toBe('regen_4w');
    expect(state.species()).toBe('boletus-edulis');
    expect(state.week()).toBeNull();
    expect(state.view()).toBe('forecast');
    expect(state.opacity()).toBe(1);
    expect(state.detent()).toBe(1);
    expect(state.background()).toBe('map');
  });

  it('saves the state after the debounce, without the week', async () => {
    vi.useFakeTimers();
    const state = TestBed.inject(MapStore);
    state.setSpecies('cantharellus-cibarius');
    state.setWeek('2025-40');
    state.setView('layer');
    state.setDetent(0);
    TestBed.tick();

    await vi.advanceTimersByTimeAsync(SAVE_DELAY);

    expect(stored()['species']).toBe('cantharellus-cibarius');
    expect(stored()['week']).toBeUndefined();
    expect(stored()['view']).toBe('layer');
    expect(stored()['detent']).toBe(0);
    vi.useRealTimers();
  });

  it('does not restore a saved week at the start', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ species: 'imleria-badia', week: '2025-40' }));

    const state = TestBed.inject(MapStore);

    expect(state.species()).toBe('imleria-badia');
    expect(state.week()).toBeNull();
  });

  it('reads a saved state and ignores bad values', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        species: 'imleria-badia',
        week: 'kaputt',
        view: 'kaputt',
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

    const state = TestBed.inject(MapStore);

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

  it('ignores a state that is not JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{kaputt');

    expect(TestBed.inject(MapStore).species()).toBe(DEFAULT_SPECIES);
  });

  it('accepts only a background that exists', () => {
    const state = TestBed.inject(MapStore);

    state.setBackground('luftschiff');
    expect(state.background()).toBe('map');

    state.setBackground('topo');
    expect(state.background()).toBe('topo');

    state.setBackground('light');
    expect(state.background()).toBe('light');
  });
});

describe('MapStore with bad values in the storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('ignores each value with a wrong shape', () => {
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

    const state = TestBed.inject(MapStore);

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

  it('ignores an empty value', () => {
    localStorage.setItem(STORAGE_KEY, 'null');

    expect(TestBed.inject(MapStore).species()).toBe(DEFAULT_SPECIES);
  });

  it('continues with a blocked storage', async () => {
    vi.useFakeTimers();
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('voll');
    });
    const state = TestBed.inject(MapStore);
    state.setSpecies('cantharellus-cibarius');
    TestBed.tick();

    await vi.advanceTimersByTimeAsync(SAVE_DELAY);

    expect(write).toHaveBeenCalled();
    write.mockRestore();
    vi.useRealTimers();
  });
});
