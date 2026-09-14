import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NOW } from '../../core/tiles/now';
import { TileService } from '../../core/tiles/tile.service';
import { SpeciesState } from '../species/species.state';
import { BUNDLE_ITEMS, RAW_LAYERS, RAW_MANIFEST, answerManifest } from '../../testing/map-doubles';
import type { SpeciesBundle } from '../species/species.state';
import { MapState } from './map.state';
import { MapView } from './map.view';

async function view(): Promise<{ view: MapView; state: MapState; tiles: TileService }> {
  answerManifest(RAW_MANIFEST, RAW_LAYERS);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: NOW, useValue: () => new Date('2025-10-02T12:00:00Z') },
    ],
  });
  const tiles = TestBed.inject(TileService);
  await tiles.load('boletus-edulis');
  await tiles.loadLayers();
  const catalogue = TestBed.inject(SpeciesState) as unknown as {
    bundle: () => SpeciesBundle | null;
  };
  catalogue.bundle = () => ({ items: BUNDLE_ITEMS }) as unknown as SpeciesBundle;
  return { view: TestBed.inject(MapView), state: TestBed.inject(MapState), tiles };
}

describe('MapView', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('nennt Art, Woche und Legende der Vorhersage', async () => {
    const { view: model } = await view();

    expect(model.title()).toBe('Steinpilz');
    expect(model.weekText()).toBe('KW 40 · 2025');
    expect(model.weeks()).toHaveLength(3);
    expect(model.rampFrom()).toBe('0 %');
    expect(model.rampTo()).toBe('50 %');
    expect(model.loading()).toBe(false);
  });

  it('bietet nur Arten mit Vorhersage zur Wahl', async () => {
    const { view: model } = await view();

    expect(model.speciesChoices().map((entry) => entry.value)).toEqual([
      'boletus-edulis',
      'cantharellus-cibarius',
    ]);
    expect(model.speciesChoices()[0].levelText).toBe('essbar');
  });

  it('nennt auf dem Reiter Ebene die Ebene und ihre Skala', async () => {
    const { view: model, state } = await view();
    state.view.set('layer');

    expect(model.onLayer()).toBe(true);
    expect(model.title()).toBe('Niederschlag der letzten 4 Wochen');
    expect(model.rampFrom()).toBe('0 mm');
    expect(model.rampTo()).toBe('152 mm');
    expect(model.layerWeek()).toBe('2025W40');
  });

  it('nennt auf dem Reiter Kombination die Kombination', async () => {
    const { view: model, state } = await view();
    state.view.set('combination');

    expect(model.title()).toBe('Kombination');
    expect(model.rampTo()).toBe('100 %');
  });

  it('nimmt Ebenen und Arten als Quellen eines Faktors', async () => {
    const { view: model } = await view();

    expect([...model.sources().keys()]).toContain('regen_4w');
    expect([...model.sources().keys()]).toContain('boletus-edulis');
  });

  it('meldet eine feste Ebene ohne Woche', async () => {
    const { view: model, state } = await view();
    state.view.set('layer');
    state.layer.set('wald');

    expect(model.fixedLayer()).toBe(true);
    expect(model.layerWeek()).toBeNull();
  });
});
