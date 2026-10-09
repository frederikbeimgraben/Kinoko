import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NOW } from '../../core/tiles/now';
import { TileService } from '../../core/tiles/tile.service';
import { SpeciesStore } from '../species/species.store';
import {
  BUNDLE_ITEMS,
  RAW_LAYERS,
  RAW_MANIFEST,
  answerManifest,
  answerMissing,
  answerNoReply,
} from '../../testing/map-doubles';
import type { SpeciesEntry } from '../../core/api/models';
import { CombinationStore } from './combination.store';
import { MapStore } from './map.store';
import { MapView } from './map.view';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';

/** `RAW_LAYERS` with three fixed layers that need a credit, only for these tests. */
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
  answer: () => void = () => {
    answerManifest(manifest, layers);
  },
): Promise<{ view: MapView; state: MapStore; combination: CombinationStore; tiles: TileService }> {
  answer();
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
  const catalogue = TestBed.inject(SpeciesStore) as unknown as {
    species: () => readonly SpeciesEntry[];
  };
  catalogue.species = () => BUNDLE_ITEMS as unknown as readonly SpeciesEntry[];
  return {
    view: TestBed.inject(MapView),
    state: TestBed.inject(MapStore),
    combination: TestBed.inject(CombinationStore),
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
    expect(model.rampLabel()).toBe('Fundwahrscheinlichkeit je Begehung');
    expect(model.loading()).toBe(false);
  });

  it('zeigt statt des Skeletts einen Fehler, wenn beide Manifeste ausbleiben, und versucht es neu', async () => {
    const { view: model, tiles } = await view(null, null, answerNoReply);

    expect(model.failed()).toBe(true);
    expect(model.loading()).toBe(false);

    answerManifest();
    model.retry();
    expect(model.failed()).toBe(false);
    await vi.waitFor(() => {
      expect(tiles.layers()).not.toBeNull();
    });
    expect(model.loading()).toBe(false);
  });

  it('meldet „noch keine Vorhersage“, wenn der Server beide Manifeste nicht hat', async () => {
    const { view: model } = await view(null, null, answerMissing);

    expect(model.empty()).toBe(true);
    expect(model.noForecast()).toBe(true);
    expect(model.failed()).toBe(false);
    expect(model.loading()).toBe(false);
  });

  it('bietet einen neuen Versuch, wenn ein Manifest fehlt und der Server zum anderen nicht antwortet', async () => {
    const missing = new Response(null, { status: 404 });
    vi.stubGlobal('fetch', (path: string) =>
      path === '/layers.json' ? Promise.resolve(missing) : Promise.reject(new TypeError('Failed to fetch')),
    );
    const { view: model } = await view(null, null, () => undefined);

    expect(model.failed()).toBe(true);
    expect(model.empty()).toBe(false);
    expect(model.loading()).toBe(false);
  });

  it('zeigt ohne Vorhersage der Art die Ebenen, aber auf dem Reiter Vorhersage den leeren Zustand', async () => {
    vi.stubGlobal('fetch', (path: string) =>
      Promise.resolve(
        path === '/layers.json'
          ? new Response(JSON.stringify(RAW_LAYERS), { headers: { 'content-type': 'application/json' } })
          : new Response(null, { status: 404 }),
      ),
    );
    const { view: model, state } = await view(null, null, () => undefined);

    expect(model.empty()).toBe(false);
    expect(model.forecastMissing()).toBe(true);
    expect(model.noForecast()).toBe(true);
    expect(model.loading()).toBe(false);

    state.setView('layer');
    expect(model.noForecast()).toBe(false);
    expect(model.layer()).not.toBeNull();
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
    state.setView('layer');

    expect(model.onLayer()).toBe(true);
    expect(model.title()).toBe('Niederschlag der letzten 4 Wochen');
    expect(model.rampFrom()).toBe('0 mm');
    expect(model.rampTo()).toBe('152 mm');
    expect(model.layerWeek()).toBe('2025W40');
  });

  it('nennt auf dem Reiter Kombination die Kombination', async () => {
    const { view: model, state } = await view();
    state.setView('combination');

    expect(model.title()).toBe('Kombination');
    expect(model.rampTo()).toBe('100 %');
    // "Abgestuft" shows how well the factors agree, not a probability of a find.
    expect(model.rampLabel()).toBe('Übereinstimmung mit den Faktoren');
  });

  it('nimmt Ebenen und Arten als Quellen eines Faktors', async () => {
    const { view: model } = await view();

    expect([...model.sources().keys()]).toContain('regen_4w');
    expect([...model.sources().keys()]).toContain('boletus-edulis');
  });

  it('wählt die erste Art mit Vorhersage, wenn die gemerkte keine hat', async () => {
    const { view: model, state } = await view();
    state.setSpecies('amanita-phalloides');

    expect(model.noSpecies()).toBe(false);
    expect(model.slug()).toBe('boletus-edulis');
    expect(model.title()).toBe('Steinpilz');
  });

  it('bittet um eine Art, wenn keine eine Vorhersage hat', async () => {
    const { view: model } = await view();
    const catalogue = TestBed.inject(SpeciesStore) as unknown as {
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
    state.setView('layer');
    state.setLayer('wald');

    expect(model.fixedLayer()).toBe(true);
    expect(model.layerWeek()).toBeNull();
  });

  it('nennt keinen Vermerk ohne Quellenpflicht', async () => {
    const { view: model } = await view();

    expect(model.creditNote()).toBeNull();
    expect(model.baseCredit()).toBeNull();
  });

  it('nennt die Quelle des Geländes und des Luftbilds als Grundkarte', async () => {
    const { view: model, state } = await view();

    state.setBackground('topo');
    expect(model.baseCredit()).toBe('© BKG, dl-de/by-2-0');
    state.setBackground('satellite');
    expect(model.baseCredit()).toContain('Copernicus');
  });

  it('nennt den Vermerk einer festen Ebene mit Quellenpflicht, auch in der Vorhersage', async () => {
    const { view: model, state } = await view(RAW_MANIFEST, CREDIT_LAYERS);
    state.setLayer('fichte');

    expect(model.creditNote()).toBe('Thünen-Institut, CC BY 4.0');
  });

  it('verbindet die Vermerke einer Kombination', async () => {
    const { view: model, state, combination } = await view(RAW_MANIFEST, CREDIT_LAYERS);
    state.setView('combination');
    patchState(unprotected(combination), {
      factors: [
        { source: 'fichte', condition: 'above', low: 0.3, high: 0, active: true },
        { source: 'relief', condition: 'above', low: 10, high: 0, active: true },
      ],
    });

    expect(model.creditNote()).toBe('Thünen-Institut, CC BY 4.0 · Landesvermessung, DGM 25');
  });

  it('lässt doppelte Vermerke einer Kombination einmal stehen', async () => {
    const { view: model, state, combination } = await view(RAW_MANIFEST, CREDIT_LAYERS);
    state.setView('combination');
    patchState(unprotected(combination), {
      factors: [
        { source: 'fichte', condition: 'above', low: 0.3, high: 0, active: true },
        { source: 'buche', condition: 'above', low: 0.3, high: 0, active: true },
      ],
    });

    expect(model.creditNote()).toBe('Thünen-Institut, CC BY 4.0');
  });
});
