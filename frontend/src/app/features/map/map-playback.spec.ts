import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NOW } from '../../core/tiles/now';
import { TileService } from '../../core/tiles/tile.service';
import { RAW_LAYERS, RAW_MANIFEST, answerManifest } from '../../testing/map-doubles';
import { MapPlayback } from './map-playback';
import { MapState } from './map.state';

async function playback(): Promise<{ playback: MapPlayback; state: MapState }> {
  answerManifest(RAW_MANIFEST, RAW_LAYERS);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: NOW, useValue: () => new Date('2025-10-02T12:00:00Z') },
    ],
  });
  await TestBed.inject(TileService).load('boletus-edulis');
  return { playback: TestBed.inject(MapPlayback), state: TestBed.inject(MapState) };
}

describe('MapPlayback', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('wählt eine Woche und hält die Wiedergabe an', async () => {
    const { playback: player, state } = await playback();

    player.select({ year: 2025, week: 39 });

    expect(state.week()).toBe('2025-39');
    expect(player.playing()).toBe(false);
  });

  it('geht eine Woche vor und zurück, ohne über die Enden', async () => {
    const { playback: player, state } = await playback();

    player.step(1);
    expect(state.week()).toBe('2025-41');

    player.step(1);
    expect(state.week()).toBe('2025-41');

    player.step(-1);
    expect(state.week()).toBe('2025-40');
  });

  it('spielt die Wochen ab und hält am Ende an', async () => {
    vi.useFakeTimers();
    const { playback: player, state } = await playback();

    player.toggle();
    expect(player.playing()).toBe(true);

    await vi.advanceTimersByTimeAsync(700);
    expect(state.week()).toBe('2025-41');

    await vi.advanceTimersByTimeAsync(700);
    expect(player.playing()).toBe(false);
    vi.useRealTimers();
  });

  it('hält auf einen zweiten Druck an', async () => {
    vi.useFakeTimers();
    const { playback: player } = await playback();

    player.toggle();
    player.toggle();

    expect(player.playing()).toBe(false);
    vi.useRealTimers();
  });
});
