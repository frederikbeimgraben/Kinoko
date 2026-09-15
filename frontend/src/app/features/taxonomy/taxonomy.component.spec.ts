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
import { TaxonomyComponent } from './taxonomy.component';

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
      expect(container.querySelector('.taxonomy__trail')).not.toBeNull();
    });
  }
  return { container, http, router: TestBed.inject(Router) };
}

describe('TaxonomyComponent', () => {
  it('zeigt den Weg von oben und die eigene Stufe am Ende', async () => {
    const { container } = await build('family', 'boletaceae');

    expect(container.querySelector('.taxonomy__trail')?.textContent).toContain('Ordnung Boletales');
    expect(container.querySelector('.taxonomy__trail')?.textContent).toContain('Familie Boletaceae');
    await noViolations(container);
  });

  it('führt die Gattungen darunter mit ihrer Zahl', async () => {
    await build('family', 'boletaceae');

    expect(screen.getByText('Gattungen')).toBeInTheDocument();
    expect(screen.getByText('Boletus')).toBeInTheDocument();
    expect(screen.getByText('3 Arten')).toBeInTheDocument();
    expect(screen.getByText('1 Art')).toBeInTheDocument();
  });

  it('führt die Arten dieser Stufe', async () => {
    await build('family', 'boletaceae');

    expect(screen.getByText('Arten dieser Familie')).toBeInTheDocument();
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Boletus edulis')).toBeInTheDocument();
  });

  it('führt von einer Gattung zur nächsten Stufe', async () => {
    const setup = await build('family', 'boletaceae');
    const go = vi.spyOn(setup.router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: /^Boletus 3 Arten$/ }));

    expect(go).toHaveBeenCalledWith('/taxonomie/genus/boletus');
  });

  it('führt von einer Zeile zur Artseite', async () => {
    const setup = await build('family', 'boletaceae');
    const go = vi.spyOn(setup.router, 'navigate');

    await userEvent.click(screen.getByText('Steinpilz'));

    expect(go).toHaveBeenCalledWith(['/arten', 'steinpilz']);
  });

  it('geht über den Kopf zurück', async () => {
    await build('family', 'boletaceae');
    const back = vi.spyOn(TestBed.inject(Location), 'back');

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(back).toHaveBeenCalled();
  });

  it('zeigt den Leerzustand zu einer unbekannten Stufe', async () => {
    await build('genus', 'nichts', null);

    await vi.waitFor(() => {
      expect(screen.getByText('Art nicht gefunden')).toBeInTheDocument();
    });
  });

  it('zeigt den Leerzustand zu einem unbekannten Rang, ohne zu fragen', async () => {
    const { container } = await render(TaxonomyComponent, {
      inputs: { rank: 'reich', slug: 'fungi' },
      providers: [...catalogueProviders(), provideRouter(ANY_ROUTE)],
    });

    expect(screen.getByText('Art nicht gefunden')).toBeInTheDocument();
    TestBed.inject(HttpTestingController).expectNone('/api/taxa/reich/fungi');
    expect(container.querySelector('.taxonomy__trail')).toBeNull();
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
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
