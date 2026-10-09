import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { SpeciesBundle } from '../../core/api/models';
import { ViewportService } from '../../core/layout/viewport.service';
import { noViolations } from '../../testing/axe';
import { catalogueProviders, catalogueReady } from '../../testing/catalogue-double';
import { stubIntersectionObserver } from '../../testing/observer-stub';
import { ANY_ROUTE } from '../../testing/routes';
import { speciesBundle, speciesEntry } from '../../testing/species-fixture';
import { FORECAST_VALUE } from './facets';
import { SpeciesFilterStore } from './filter.store';
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

/** A catalogue with more species than one page. */
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
  filter: SpeciesFilterStore;
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
  return { container, filter: TestBed.inject(SpeciesFilterStore), router: TestBed.inject(Router) };
}

describe('SpeciesListComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('pilzkarte.speciesfilter');
    stubIntersectionObserver();
  });

  it('shows the species of the bundle sorted by name, with a hidden page title', async () => {
    const { container } = await build();

    const names = [...container.querySelectorAll('.row__name')].map((one) => one.textContent);
    expect(names).toEqual(['Pfifferling', 'Steinpilz']);
    expect(screen.getByRole('heading', { name: 'Arten' })).toHaveClass('sr-only');
    await noViolations(container);
  });

  it('searches the German name on the device', async () => {
    await build();

    await userEvent.type(screen.getByRole('textbox'), 'stein');

    await vi.waitFor(() => {
      expect(screen.queryByText('Pfifferling')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
  });

  it('searches the Latin name on the device', async () => {
    await build();

    await userEvent.type(screen.getByRole('textbox'), 'canthar');

    await vi.waitFor(() => {
      expect(screen.queryByText('Steinpilz')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Pfifferling')).toBeInTheDocument();
  });

  it('shows the group with a choice as a chip and opens the filter sheet on a press', async () => {
    const { filter } = await build();

    filter.toggle('edibility', 'edible');
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: /Speisewert/ })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /Speisewert/ }));

    expect(filter.open()).toBe(true);
  });

  it('shows the empty state without hits and resets the filter from it', async () => {
    const { filter } = await build();

    filter.toggle('hymenium', 'gills');
    await vi.waitFor(() => {
      expect(screen.getByText('Keine Treffer')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));

    expect(filter.chosenCount()).toBe(0);
  });

  it('opens the filter sheet from the chip with the filter icon', async () => {
    const { filter } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));

    expect(filter.open()).toBe(true);
  });

  it('shows the error state and tries again', async () => {
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
      expect(screen.getByText('Keine Verbindung')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    await vi.waitFor(() => {
      http.expectOne('/api/species/bundle').flush(SMALL);
    });
    await vi.waitFor(() => {
      expect(container.querySelectorAll('app-species-row')).toHaveLength(2);
    });
  });

  it('shows one page of 40 species first', async () => {
    const { container } = await build(manySpecies(PAGE + 1));

    await vi.waitFor(() => {
      expect(container.querySelectorAll('app-species-row')).toHaveLength(PAGE);
    });
  });

  it('goes from a row to the species page', async () => {
    const setup = await build();
    const go = vi.spyOn(setup.router, 'navigate');

    await userEvent.click(screen.getByText('Steinpilz'));

    expect(go).toHaveBeenCalledWith(['/arten', 'steinpilz']);
  });

  it('puts the filter column next to the list on the desktop', async () => {
    const { container, router } = await build(SMALL, true);
    const go = vi.spyOn(router, 'navigate');

    expect(container.querySelector('app-species-browser')).not.toBeNull();
    expect(container.querySelector('app-species-filter-panel')).not.toBeNull();
    await userEvent.click(screen.getByText('Pfifferling'));

    expect(go).toHaveBeenCalledWith(['/arten', 'pfifferling']);
  });

  it('drops the species without forecast and shows no second block', async () => {
    const { container, filter } = await build(FORECAST_MIX, true);

    filter.toggle('forecast', FORECAST_VALUE);

    await vi.waitFor(() => {
      expect(container.querySelectorAll('app-species-row')).toHaveLength(1);
    });
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(container.querySelector('.results__muted')).toBeNull();
    expect(screen.queryByText(/Nicht beurteilbar/)).not.toBeInTheDocument();
  });

  it('keeps the second block while a species has no colour data', async () => {
    const { container, filter } = await build(COLOUR_MIX, true);

    filter.setColour('cap', '#6b4423');

    await vi.waitFor(() => {
      expect(container.querySelector('.results__muted')).not.toBeNull();
    });
    expect(screen.getByText('Nicht beurteilbar · 1')).toBeInTheDocument();
  });

  it('sorts the list by the Latin name from the sort popover', async () => {
    const { container } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Sortieren' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lateinischer Name' }));

    await vi.waitFor(() => {
      const names = [...container.querySelectorAll('.row__name')].map((one) => one.textContent);
      expect(names).toEqual(['Steinpilz', 'Pfifferling']);
    });
    expect(TestBed.inject(SpeciesFilterStore).sort()).toBe('latin');
  });

  it('opens the glossary from the menu', async () => {
    const { router } = await build();
    const go = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Mehr' }));
    await userEvent.click(screen.getByRole('button', { name: 'Glossar' }));

    expect(go).toHaveBeenCalledWith('/konto/glossar');
  });
});
