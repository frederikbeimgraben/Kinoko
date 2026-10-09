import { signal } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ViewportService } from '../../core/layout/viewport.service';
import { HistoryService } from '../../core/navigation/history.service';
import { noViolations } from '../../testing/axe';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { catalogueProviders, catalogueReady } from '../../testing/catalogue-double';
import { stubIntersectionObserver } from '../../testing/observer-stub';
import { ANY_ROUTE } from '../../testing/routes';
import { speciesBundle, speciesEntry } from '../../testing/species-fixture';
import { SpeciesPageComponent } from './species-page.component';

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  genusName: 'Boletus',
  familyName: 'Boletaceae',
  forecastEnabled: true,
  periodStartMonth: 6,
  periodEndMonth: 10,
  hymeniumType: 'tubes',
  measurements: [{ part: 'cap', measurements: [{ dimension: 'width', unit: 'cm', low: 4, high: 20 }] }],
  colours: [{ part: 'cap', mode: 'gradient', colours: [{ name: 'braun', hex: '#6b4423' }] }],
  lookalikes: [
    {
      slug: 'tylopilus-felleus',
      name: 'Gallenröhrling',
      scientificName: 'Tylopilus felleus',
      edibility: 'inedible',
      capColours: [{ name: 'hellbraun', hex: '#d8b98a' }],
      difference: null,
    },
  ],
});

async function build(slug = 'boletus-edulis', wide = false): Promise<Element> {
  const { container } = await render(SpeciesPageComponent, {
    providers: [
      ...catalogueProviders(speciesBundle([STONE])),
      ...authStubProviders(new AuthStub()),
      provideRouter(ANY_ROUTE),
      { provide: ViewportService, useValue: { wide: signal(wide) } },
    ],
    inputs: { slug },
  });
  await catalogueReady();
  return container;
}

describe('SpeciesPageComponent', () => {
  beforeEach(() => {
    stubIntersectionObserver();
  });

  it('shows the sections of the catalogue', async () => {
    const container = await build();

    expect(screen.getByRole('heading', { name: 'Steinpilz' })).toBeInTheDocument();
    expect(container.querySelector('app-species-features')).not.toBeNull();
    expect(container.querySelector('app-species-size')).not.toBeNull();
    expect(container.querySelector('app-species-colours')).not.toBeNull();
    expect(container.querySelector('app-species-time')).not.toBeNull();
    expect(container.querySelector('app-species-photos')).not.toBeNull();
    await noViolations(container);
  });

  it('makes the hero lower without a photo, per SpeciesPageNoPhoto', async () => {
    const container = await build();

    expect(container.querySelector<HTMLElement>('.heroframe')?.style.height).toBe('220px');
  });

  it('puts the sections in the order of the boards', async () => {
    const container = await build();

    const order = [...container.querySelectorAll('.pad > *')].map((one) => one.tagName.toLowerCase());
    expect(order).toEqual([
      'app-species-lead',
      'div',
      'app-species-features',
      'app-species-taxonomy',
      'app-species-size',
      'app-species-traits',
      'app-species-colours',
      'app-species-reactions',
      'app-species-time',
      'app-species-senses',
      'app-species-hymenium',
      'app-species-lookalikes',
      'app-species-photos',
      'app-species-sources',
    ]);
  });

  it('shows the reactions from the profile in the section "Verfärbung"', async () => {
    await build();

    TestBed.inject(HttpTestingController)
      .expectOne('/api/species/boletus-edulis')
      .flush({
        ...STONE,
        reactions: [
          {
            reagent: { slug: 'koh', name: 'Kalilauge' },
            reading: 'Huthaut gelblich',
            part: 'cap',
            location: null,
            result: 'positive',
            colour: { name: 'Gelb', hex: '#d8c040' },
            contested: false,
            partlyConfirmed: false,
            sources: [],
          },
        ],
      });

    expect(await screen.findByText('Kalilauge')).toBeInTheDocument();
    expect(screen.getByText('Verfärbung')).toBeInTheDocument();
  });

  it('shows the empty state with an empty title for an unknown slug', async () => {
    const container = await build('gibt-es-nicht');

    expect(screen.getByText('Art nicht gefunden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zu allen Arten' })).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
    await noViolations(container);
  });

  it('goes back to the list without app history, for example after a shared link', async () => {
    await build();
    const back = vi.spyOn(TestBed.inject(HistoryService), 'back').mockImplementation(() => undefined);

    await userEvent.click(screen.getAllByRole('button', { name: 'Zurück' })[0]);

    expect(back).toHaveBeenCalledWith(['/arten']);
  });

  it('shows the lookalike with its own way to the comparison', async () => {
    await build();

    expect(screen.getAllByRole('button', { name: 'Vergleichen' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Gallenröhrling' })).toBeInTheDocument();
  });

  it('opens the compare sheet from the chip and goes to the comparison with both species', async () => {
    const container = await build();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await userEvent.click(screen.getAllByRole('button', { name: 'Vergleichen' })[0]);
    const sheet = container.querySelector('app-compare-entry');
    expect(sheet).not.toBeNull();
    expect(sheet?.querySelector('app-species-lookalikes')).not.toBeNull();
    expect(screen.getByRole('textbox', { name: 'Art suchen' })).toBeInTheDocument();

    const compare = sheet?.querySelector<HTMLElement>(
      'app-species-lookalikes button[aria-label="Vergleichen"]',
    );
    compare?.click();

    expect(navigate).toHaveBeenCalledWith(['/arten/vergleich'], {
      queryParams: { arten: 'boletus-edulis,tylopilus-felleus' },
    });
  });

  it('opens the menu with share and submit image', async () => {
    await build();

    await userEvent.click(screen.getByRole('button', { name: 'Mehr' }));

    expect(screen.getByRole('button', { name: 'Teilen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bild einreichen' })).toBeInTheDocument();
  });

  it('shows two columns next to the list pane on the desktop', async () => {
    const container = await build('boletus-edulis', true);

    expect(container.querySelector('.layout--columns')).not.toBeNull();
    expect(container.querySelector('app-species-browser')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Zurück' })).toBeNull();
  });
});
