import { Location } from '@angular/common';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { TaxonPage } from '../../core/api/models';
import { noViolations } from '../../testing/axe';
import { catalogueProviders } from '../../testing/catalogue-double';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ANY_ROUTE } from '../../testing/routes';
import { speciesSummary, taxonPage, taxonStep } from '../../testing/species-fixture';
import { TaxonomyComponent, rankRows } from './taxonomy.component';

const NOT_FOUND = 404;

const BOLETACEAE: TaxonPage = taxonPage({
  rank: 'family',
  slug: 'boletaceae',
  name: 'Boletaceae',
  path: [taxonStep('order', 'boletales', 'Boletales')],
  children: [
    { ...taxonStep('genus', 'boletus', 'Boletus'), speciesCount: 3 },
    { ...taxonStep('genus', 'leccinum', 'Leccinum'), speciesCount: 1 },
  ],
  species: [speciesSummary({ slug: 'steinpilz', name: 'Steinpilz', scientificName: 'Boletus edulis' })],
  speciesCount: 4,
});

interface Setup {
  container: Element;
  http: HttpTestingController;
  router: Router;
}

async function build(rank: string, slug: string, page: TaxonPage | null = BOLETACEAE): Promise<Setup> {
  const { container } = await render(TaxonomyComponent, {
    inputs: { rank, slug },
    providers: [...catalogueProviders(), provideRouter(ANY_ROUTE)],
  });
  const http = TestBed.inject(HttpTestingController);
  const path = `/api/taxa/${rank}/${slug}`;
  if (page === null) {
    await vi.waitFor(() => {
      http.expectOne(path).flush(null, { status: NOT_FOUND, statusText: 'Not Found' });
    });
  } else {
    await vi.waitFor(() => {
      http.expectOne(path).flush(page);
    });
    await vi.waitFor(() => {
      expect(screen.getByText('Rang')).toBeInTheDocument();
    });
  }
  return { container, http, router: TestBed.inject(Router) };
}

describe('rankRows', () => {
  it('ends with the page itself and marks it', () => {
    const rows = rankRows(BOLETACEAE, (rank) => rank);

    expect(rows.map((row) => `${row.rank} ${row.name}`)).toEqual(['order Boletales', 'family Boletaceae']);
    expect(rows.map((row) => row.current)).toEqual([false, true]);
  });
});

describe('TaxonomyComponent', () => {
  it('shows the ranks from the top as rows', async () => {
    const { container } = await build('family', 'boletaceae');

    expect(screen.getByText('Ordnung')).toBeInTheDocument();
    expect(screen.getByText('Boletales')).toBeInTheDocument();
    expect(screen.getByText('Boletaceae')).toBeInTheDocument();
    await noViolations(container);
  });

  it('shows the genera below with their count', async () => {
    await build('family', 'boletaceae');

    expect(screen.getByText('Gattungen')).toBeInTheDocument();
    expect(screen.getByText('Boletus')).toBeInTheDocument();
    expect(screen.getByText('3 Arten')).toBeInTheDocument();
    expect(screen.getByText('1 Art')).toBeInTheDocument();
  });

  it('shows the species of this step', async () => {
    await build('family', 'boletaceae');

    expect(screen.getByText('Arten dieser Familie')).toBeInTheDocument();
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Boletus edulis')).toBeInTheDocument();
  });

  it('goes from a genus to the lower step', async () => {
    const setup = await build('family', 'boletaceae');
    const go = vi.spyOn(setup.router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: /^Boletus 3 Arten$/ }));

    expect(go).toHaveBeenCalledWith('/taxonomie/genus/boletus');
  });

  it('goes from a rank row to the upper step', async () => {
    const setup = await build('family', 'boletaceae');
    const go = vi.spyOn(setup.router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: /^Ordnung Boletales$/ }));

    expect(go).toHaveBeenCalledWith('/taxonomie/order/boletales');
  });

  it('goes from a species row to the species page', async () => {
    const setup = await build('family', 'boletaceae');
    const go = vi.spyOn(setup.router, 'navigate');

    await userEvent.click(screen.getByText('Steinpilz'));

    expect(go).toHaveBeenCalledWith(['/arten', 'steinpilz']);
  });

  it('goes back through the head', async () => {
    await build('family', 'boletaceae');
    const back = vi.spyOn(TestBed.inject(Location), 'back');

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(back).toHaveBeenCalled();
  });

  it('shows the empty state for an unknown step', async () => {
    await build('genus', 'nichts', null);

    await vi.waitFor(() => {
      expect(screen.getByText('Art nicht gefunden')).toBeInTheDocument();
    });
  });

  it('shows the empty state for an unknown rank and sends no request', async () => {
    await render(TaxonomyComponent, {
      inputs: { rank: 'reich', slug: 'fungi' },
      providers: [...catalogueProviders(), provideRouter(ANY_ROUTE)],
    });

    expect(screen.getByText('Art nicht gefunden')).toBeInTheDocument();
    TestBed.inject(HttpTestingController).expectNone('/api/taxa/reich/fungi');
    expect(screen.queryByText('Rang')).toBeNull();
  });

  it('has no German word with an empty catalogue', async () => {
    const { container } = await render(TaxonomyComponent, {
      inputs: { rank: 'family', slug: 'boletaceae' },
      providers: [...catalogueProviders(), provideRouter(ANY_ROUTE), EMPTY_CATALOG],
    });
    await vi.waitFor(() => {
      TestBed.inject(HttpTestingController).expectOne('/api/taxa/family/boletaceae').flush(BOLETACEAE);
    });

    noGermanText(container);
  });
});
