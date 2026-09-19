import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { SpeciesBundle } from '../../core/api/models';
import { AccessApiDouble, accessApiProvider } from '../../testing/access-fixture';
import { noViolations } from '../../testing/axe';
import { catalogueProviders, catalogueReady } from '../../testing/catalogue-double';
import { stubIntersectionObserver } from '../../testing/observer-stub';
import { ANY_ROUTE } from '../../testing/routes';
import { speciesBundle, speciesEntry } from '../../testing/species-fixture';
import { AdminSpeciesComponent } from './admin-species.component';

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  forecastEnabled: true,
});

const EARTH = speciesEntry({
  slug: 'tricholoma-terreum',
  name: 'Erdritterling',
  scientificName: 'Tricholoma terreum',
  forecastEnabled: false,
});

const BUNDLE: SpeciesBundle = speciesBundle([STONE, EARTH]);

async function build(api = new AccessApiDouble()): Promise<{ container: Element; router: Router }> {
  api.speciesCountsAnswer = [
    { speciesId: STONE.id, records: 1284, finds: 12, photos: 3 },
    { speciesId: EARTH.id, records: 58, finds: 0, photos: 0 },
  ];
  const { container } = await render(AdminSpeciesComponent, {
    providers: [...catalogueProviders(BUNDLE), provideRouter(ANY_ROUTE), accessApiProvider(api)],
  });
  await catalogueReady();
  await vi.waitFor(() => {
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
  });
  return { container, router: TestBed.inject(Router) };
}

describe('AdminSpeciesComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('pilzkarte.speciesfilter');
    stubIntersectionObserver();
  });

  it('zeigt jede Art mit Namen, lateinischem Namen und ihren Zahlen', async () => {
    const { container } = await build();

    expect(screen.getByText('Boletus edulis')).toBeInTheDocument();
    expect(screen.getByText('1 284')).toBeInTheDocument();
    expect(screen.getByText('58')).toBeInTheDocument();
    await noViolations(container);
  });

  it('trägt den Namen einer Art in der Primärfarbe', async () => {
    await build();

    expect(screen.getByText('Steinpilz').closest('.row__title--accent')).not.toBeNull();
  });

  it('kennzeichnet eine Art ohne Vorhersage', async () => {
    await build();

    expect(screen.getAllByLabelText('Ohne Vorhersage')).toHaveLength(1);
  });

  it('sucht im Namen und im lateinischen Namen', async () => {
    await build();

    await userEvent.type(screen.getByRole('textbox'), 'terreum');

    expect(screen.queryByText('Steinpilz')).not.toBeInTheDocument();
    expect(screen.getByText('Erdritterling')).toBeInTheDocument();
  });

  it('legt über die erste Zeile eine neue Art an', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigate');

    await userEvent.click(screen.getByRole('button', { name: 'Art anlegen' }));

    expect(navigate).toHaveBeenCalledWith(['/verwaltung/arten', 'neu']);
  });
});
