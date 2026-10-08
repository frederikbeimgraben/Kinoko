import { TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { MapAppStore } from './map-app.store';

function store(): MapAppStore {
  TestBed.resetTestingModule();
  const maps = TestBed.inject(MapAppStore);
  TestBed.tick();
  return maps;
}

describe('MapAppStore', () => {
  beforeEach(() => {
    localStorage.removeItem('pilzkarte.kartenApp');
  });

  it('starts with OpenStreetMap', () => {
    expect(store().choice()).toBe('osm');
  });

  it('accepts a choice and keeps it as bare text', () => {
    const maps = store();

    maps.setChoice('google');
    TestBed.tick();

    expect(maps.choice()).toBe('google');
    expect(localStorage.getItem('pilzkarte.kartenApp')).toBe('google');
  });

  it('reads the saved choice at the start', () => {
    localStorage.setItem('pilzkarte.kartenApp', 'google');

    expect(store().choice()).toBe('google');
  });

  it('ignores a saved value that is not a map app', () => {
    localStorage.setItem('pilzkarte.kartenApp', 'apple');

    expect(store().choice()).toBe('osm');
  });

  it('writes a patched state', () => {
    const maps = store();

    patchState(unprotected(maps), { choice: 'google' });
    TestBed.tick();

    expect(localStorage.getItem('pilzkarte.kartenApp')).toBe('google');
  });

  it('works without storage', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    const maps = store();
    maps.setChoice('google');
    TestBed.tick();

    expect(maps.choice()).toBe('google');
    read.mockRestore();
    write.mockRestore();
  });
});
