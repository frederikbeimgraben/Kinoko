import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NOW } from '../../core/tiles/now';
import { TileService } from '../../core/tiles/tile.service';
import { SpeciesState } from '../species/species.state';
import { BUNDLE_ITEMS, RAW_LAYERS, RAW_MANIFEST, answerManifest } from '../../testing/map-doubles';
import type { SpeciesEntry } from '../../core/api/models';
import { CombinationState } from './combination.state';
import { MapState } from './map.state';
import { MapView } from './map.view';

/** `RAW_LAYERS` mit drei festen Ebenen, die Quellenpflicht tragen, nur für diese Tests. */
const CREDIT_LAYERS = {
  bounds: RAW_LAYERS.bounds,
  layers: {
    ...RAW_LAYERS.layers,
    fichte: {
      label: 'Fichte',
      unit: '',
      static: true,
      low: 0,
      high: 1,
      tiles: 'layers_kacheln/fichte',
      zooms: [5, 14],
      note: 'Thünen-Institut, CC BY 4.0',
    },
    buche: {
      label: 'Buche',
      unit: '',
      static: true,
      low: 0,
      high: 1,
      tiles: 'layers_kacheln/buche',
      zooms: [5, 14],
      note: 'Thünen-Institut, CC BY 4.0',
    },
    relief: {
      label: 'Relief',
      unit: 'm',
      static: true,
      low: 0,
      high: 50,
      tiles: 'layers_kacheln/relief',
      zooms: [5, 8],
      note: 'Landesvermessung, DGM 25',
    },
  },
};

async function view(
  manifest: unknown = RAW_MANIFEST,
  layers: unknown = RAW_LAYERS,
): Promise<{ view: MapView; state: MapState; combination: CombinationState; tiles: TileService }> {
  answerManifest(manifest, layers);
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
    species: () => readonly SpeciesEntry[];
  };
  catalogue.species = () => BUNDLE_ITEMS as unknown as readonly SpeciesEntry[];
  return {
    view: TestBed.inject(MapView),
    state: TestBed.inject(MapState),
    combination: TestBed.inject(CombinationState),
    tiles,
  };
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

  it('wählt die erste Art mit Vorhersage, wenn die gemerkte keine hat', async () => {
    const { view: model, state } = await view();
    state.species.set('amanita-phalloides');

    expect(model.noSpecies()).toBe(false);
    expect(model.slug()).toBe('boletus-edulis');
    expect(model.title()).toBe('Steinpilz');
  });

  it('bittet um eine Art, wenn keine eine Vorhersage hat', async () => {
    const { view: model } = await view();
    const catalogue = TestBed.inject(SpeciesState) as unknown as {
      species: () => readonly SpeciesEntry[];
    };
    catalogue.species = () => [];

    expect(model.noSpecies()).toBe(true);
    expect(model.title()).toBe('Art wählen');
    expect(model.speciesName()).toBe('');
  });

  it('richtet Vorhersage in der Zeitleiste nach heute, nicht nach dem Kettenkennzeichen', async () => {
    const { view: model } = await view({
      ...RAW_MANIFEST,
      weeks: [
        { year: 2025, week: 39, forecast: true, tiles: 'x/2025W39', mean: 0.05, max: 0.3 },
        { year: 2025, week: 40, forecast: true, tiles: 'x/2025W40', mean: 0.1, max: 0.5 },
        { year: 2025, week: 41, forecast: true, tiles: 'x/2025W41', mean: 0.08, max: 0.4 },
      ],
    });

    expect(model.weeks().map((week) => week.forecast)).toEqual([false, false, true]);
  });

  it('meldet eine feste Ebene ohne Woche', async () => {
    const { view: model, state } = await view();
    state.view.set('layer');
    state.layer.set('wald');

    expect(model.fixedLayer()).toBe(true);
    expect(model.layerWeek()).toBeNull();
  });

  it('nennt keinen Vermerk ohne Quellenpflicht', async () => {
    const { view: model } = await view();

    expect(model.creditNote()).toBeNull();
  });

  it('nennt den Vermerk einer festen Ebene mit Quellenpflicht, auch in der Vorhersage', async () => {
    const { view: model, state } = await view(RAW_MANIFEST, CREDIT_LAYERS);
    state.layer.set('fichte');

    expect(model.creditNote()).toBe('Thünen-Institut, CC BY 4.0');
  });

  it('verbindet die Vermerke einer Kombination', async () => {
    const { view: model, state, combination } = await view(RAW_MANIFEST, CREDIT_LAYERS);
    state.view.set('combination');
    combination.factors.set([
      { source: 'fichte', condition: 'above', low: 0.3, high: 0, active: true },
      { source: 'relief', condition: 'above', low: 10, high: 0, active: true },
    ]);

    expect(model.creditNote()).toBe('Thünen-Institut, CC BY 4.0 · Landesvermessung, DGM 25');
  });

  it('lässt doppelte Vermerke einer Kombination einmal stehen', async () => {
    const { view: model, state, combination } = await view(RAW_MANIFEST, CREDIT_LAYERS);
    state.view.set('combination');
    combination.factors.set([
      { source: 'fichte', condition: 'above', low: 0.3, high: 0, active: true },
      { source: 'buche', condition: 'above', low: 0.3, high: 0, active: true },
    ]);

    expect(model.creditNote()).toBe('Thünen-Institut, CC BY 4.0');
  });
});
