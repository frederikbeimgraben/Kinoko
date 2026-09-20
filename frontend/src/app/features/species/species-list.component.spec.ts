import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { SpeciesBundle } from '../../core/api/models';
import { ViewportService } from '../../core/layout/viewport.service';
import { noViolations } from '../../testing/axe';
import { catalogueProviders, catalogueReady } from '../../testing/catalogue-double';
import { stubIntersectionObserver } from '../../testing/observer-stub';
import { ANY_ROUTE } from '../../testing/routes';
import { speciesBundle, speciesEntry } from '../../testing/species-fixture';
import { FORECAST_VALUE } from './facets';
import { SpeciesFilterState } from './filter.state';
import { SpeciesListComponent } from './species-list.component';

const PAGE = 40;

const STEINPILZ = speciesEntry({
  slug: 'steinpilz',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  hymeniumType: 'tubes',
});

const PFIFFERLING = speciesEntry({
  slug: 'pfifferling',
  name: 'Pfifferling',
  scientificName: 'Cantharellus cibarius',
  hymeniumType: 'folds',
});

const SEMMELSTOPPELPILZ = speciesEntry({
  slug: 'semmelstoppelpilz',
  name: 'Semmelstoppelpilz',
  scientificName: 'Hydnum repandum',
  forecastEnabled: false,
});

const MARONE = speciesEntry({
  slug: 'maronenroehrling',
  name: 'Maronenröhrling',
  scientificName: 'Imleria badia',
  colours: [{ part: 'cap', mode: 'single', colours: [{ name: 'braun', hex: '#6b4423' }] }],
});

const SMALL: SpeciesBundle = speciesBundle([STEINPILZ, PFIFFERLING]);

const FORECAST_MIX: SpeciesBundle = speciesBundle([STEINPILZ, SEMMELSTOPPELPILZ]);

const COLOUR_MIX: SpeciesBundle = speciesBundle([MARONE, STEINPILZ]);

/** Ein Katalog, der über eine Seite hinausreicht. */
function manySpecies(count: number): SpeciesBundle {
  return speciesBundle(
    Array.from({ length: count }, (_, at) =>
      speciesEntry({
        slug: `art-${String(at)}`,
        name: `Art ${String(at)}`,
        scientificName: `Genus species${String(at)}`,
      }),
    ),
  );
}

interface Setup {
  container: Element;
  filter: SpeciesFilterState;
  router: Router;
}

async function build(bundle: SpeciesBundle = SMALL, wide = false): Promise<Setup> {
  const { container } = await render(SpeciesListComponent, {
    providers: [
      ...catalogueProviders(bundle),
      provideRouter(ANY_ROUTE),
      { provide: ViewportService, useValue: { wide: signal(wide) } },
    ],
  });
  await catalogueReady();
  await vi.waitFor(() => {
    expect(container.querySelectorAll('app-species-row').length).toBeGreaterThan(0);
  });
  return { container, filter: TestBed.inject(SpeciesFilterState), router: TestBed.inject(Router) };
}

describe('SpeciesListComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('pilzkarte.speciesfilter');
    stubIntersectionObserver();
  });

  it('stellt die Arten des Bündels mit ihrer Zahl über der Liste', async () => {
    const { container } = await build();

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Pfifferling')).toBeInTheDocument();
    expect(screen.getByText('2 Arten')).toBeInTheDocument();
    await noViolations(container);
  });

  it('sucht lokal nach deutschem Namen', async () => {
    await build();

    await userEvent.type(screen.getByRole('textbox'), 'stein');

    await vi.waitFor(() => {
      expect(screen.queryByText('Pfifferling')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
  });

  it('sucht lokal nach lateinischem Namen', async () => {
    await build();

    await userEvent.type(screen.getByRole('textbox'), 'canthar');

    await vi.waitFor(() => {
      expect(screen.queryByText('Steinpilz')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Pfifferling')).toBeInTheDocument();
  });

  it('zeigt je gewähltem Wert eine Marke und nimmt sie wieder weg', async () => {
    const { filter } = await build();

    filter.toggle('hymenium', 'tubes');
    await vi.waitFor(() => {
      expect(screen.getByText('Röhren')).toBeInTheDocument();
    });

    const chip = screen.getByText('Röhren').closest('.chip');
    await userEvent.click(within(chip as HTMLElement).getByRole('button'));

    expect(filter.chosenIn('hymenium').size).toBe(0);
  });

  it('zeigt ohne Treffer den Leerzustand und setzt darüber zurück', async () => {
    const { filter } = await build();

    filter.toggle('hymenium', 'gills');
    await vi.waitFor(() => {
      expect(screen.getByText('Keine Art passt zu dieser Auswahl')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));

    expect(filter.chosenCount()).toBe(0);
  });

  it('öffnet das Filterblatt über den Knopf', async () => {
    const { filter } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));

    expect(filter.open()).toBe(true);
  });

  it('zeigt den Fehlerzustand und versucht es erneut', async () => {
    const { container } = await render(SpeciesListComponent, {
      providers: [
        ...catalogueProviders(null),
        provideRouter(ANY_ROUTE),
        { provide: ViewportService, useValue: { wide: signal(false) } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    await vi.waitFor(() => {
      http.expectOne('/api/species/bundle').error(new ProgressEvent('error'));
    });
    await vi.waitFor(() => {
      expect(screen.getByText('Laden fehlgeschlagen')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    await vi.waitFor(() => {
      http.expectOne('/api/species/bundle').flush(SMALL);
    });
    await vi.waitFor(() => {
      expect(container.querySelectorAll('app-species-row')).toHaveLength(2);
    });
  });

  it('zeigt erst eine Seite zu 40 Arten', async () => {
    const { container } = await build(manySpecies(PAGE + 1));

    await vi.waitFor(() => {
      expect(container.querySelectorAll('app-species-row')).toHaveLength(PAGE);
    });
  });

  it('führt von einer Zeile auf die Artseite', async () => {
    const setup = await build();
    const go = vi.spyOn(setup.router, 'navigate');

    await userEvent.click(screen.getByText('Steinpilz'));

    expect(go).toHaveBeenCalledWith(['/arten', 'steinpilz']);
  });

  it('stellt am Rechner Filterspalte und Liste nebeneinander', async () => {
    const { container, router } = await build(SMALL, true);
    const go = vi.spyOn(router, 'navigate');

    expect(container.querySelector('.species--wide')).not.toBeNull();
    expect(container.querySelector('app-species-filter-panel')).not.toBeNull();
    await userEvent.click(screen.getByText('Pfifferling'));

    expect(go).toHaveBeenCalledWith(['/arten', 'pfifferling']);
  });

  it('lässt die Arten ohne Vorhersage ausscheiden, ohne zweiten Block', async () => {
    const { container, filter } = await build(FORECAST_MIX, true);

    filter.toggle('forecast', FORECAST_VALUE);

    await vi.waitFor(() => {
      expect(container.querySelectorAll('app-species-row')).toHaveLength(1);
    });
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(container.querySelector('.results__card--muted')).toBeNull();
    expect(screen.queryByText(/Nicht beurteilbar/)).not.toBeInTheDocument();
  });

  it('hält den zweiten Block, solange eine Art die Farbe nicht führt', async () => {
    const { container, filter } = await build(COLOUR_MIX, true);

    filter.setColour('cap', '#6b4423');

    await vi.waitFor(() => {
      expect(container.querySelector('.results__card--muted')).not.toBeNull();
    });
    expect(screen.getByText('Nicht beurteilbar · 1')).toBeInTheDocument();
  });

  it('nennt am Rechner die Zahl der Treffer, mit der Lücke sobald ein Filter steht', async () => {
    const { container, filter } = await build(SMALL, true);

    expect(container.querySelector('.species__summary')?.textContent).toBe('2 Arten');
    filter.toggle('hymenium', 'tubes');

    await vi.waitFor(() => {
      expect(container.querySelector('.species__summary')?.textContent).toContain('1');
    });
  });
});
