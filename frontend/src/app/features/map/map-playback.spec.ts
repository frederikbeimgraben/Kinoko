import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MapPlayback } from './map-playback';
import { MapStore } from './map.store';

describe('MapPlayback', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('wählt eine Woche der Zeitleiste', () => {
    const playback = TestBed.inject(MapPlayback);
    const state = TestBed.inject(MapStore);

    playback.select({ year: 2025, week: 39 });

    expect(state.week()).toBe('2025-39');
  });
});
