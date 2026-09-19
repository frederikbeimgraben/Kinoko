import { TestBed } from '@angular/core/testing';
import { MapAppService } from './map-app.service';

function service(): MapAppService {
  TestBed.resetTestingModule();
  return TestBed.inject(MapAppService);
}

describe('MapAppService', () => {
  beforeEach(() => {
    localStorage.removeItem('pilzkarte.kartenApp');
  });

  it('beginnt bei OpenStreetMap', () => {
    expect(service().choice()).toBe('osm');
  });

  it('nimmt eine Wahl an und merkt sie sich', () => {
    const maps = service();

    maps.setChoice('google');

    expect(maps.choice()).toBe('google');
    expect(localStorage.getItem('pilzkarte.kartenApp')).toBe('google');
  });

  it('nimmt die gespeicherte Wahl beim Start', () => {
    localStorage.setItem('pilzkarte.kartenApp', 'google');

    expect(service().choice()).toBe('google');
  });

  it('kommt ohne Speicher aus', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });

    const maps = service();
    maps.setChoice('google');

    expect(maps.choice()).toBe('google');
    read.mockRestore();
    write.mockRestore();
  });
});
