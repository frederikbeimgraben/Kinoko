import { signal } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { I18nService } from '../../core/i18n/i18n.service';
import { ViewportService } from '../../core/layout/viewport.service';
import { HistoryService } from '../../core/navigation/history.service';
import { noViolations } from '../../testing/axe';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { catalogueProviders, catalogueReady } from '../../testing/catalogue-double';
import { stubIntersectionObserver } from '../../testing/observer-stub';
import { ANY_ROUTE } from '../../testing/routes';
import { speciesBundle, speciesEntry } from '../../testing/species-fixture';
import { MapStore } from '../map/map.store';
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

const REFERENCE_ONLY = speciesEntry({
  slug: 'hydnum-repandum',
  name: 'Semmelstoppelpilz',
  scientificName: 'Hydnum repandum',
  forecastEnabled: false,
});

async function build(slug = 'boletus-edulis', wide = false, stone = STONE): Promise<Element> {
  const { container } = await render(SpeciesPageComponent, {
    providers: [
      ...catalogueProviders(speciesBundle([stone, REFERENCE_ONLY])),
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

  describe('description', () => {
    const DESCRIBED = speciesEntry({
      ...STONE,
      description: 'Kräftiger Röhrling.',
      descriptionEn: 'A stout bolete.',
      descriptionDraft: true,
    });

    afterEach(() => {
      TestBed.inject(I18nService).setLocale('de');
    });

    it('shows the German description with the draft hint', async () => {
      const container = await build('boletus-edulis', false, DESCRIBED);

      expect(screen.getByText('Kräftiger Röhrling.')).toBeInTheDocument();
      expect(screen.queryByText('A stout bolete.')).not.toBeInTheDocument();
      expect(screen.getByText('Entwurf, nicht geprüft')).toBeInTheDocument();
      await noViolations(container);
    });

    it('shows the English description in English', async () => {
      await build('boletus-edulis', false, DESCRIBED);
      TestBed.inject(I18nService).setLocale('en');

      expect(await screen.findByText('A stout bolete.')).toBeInTheDocument();
      expect(screen.queryByText('Kräftiger Röhrling.')).not.toBeInTheDocument();
      expect(screen.getByText('Draft, not reviewed')).toBeInTheDocument();
    });

    it('shows the German description in English without an English text, and no hint without a draft', async () => {
      await build('boletus-edulis', false, { ...DESCRIBED, descriptionEn: '', descriptionDraft: false });
      TestBed.inject(I18nService).setLocale('en');

      expect(await screen.findByText('Kräftiger Röhrling.')).toBeInTheDocument();
      expect(screen.queryByText('Draft, not reviewed')).not.toBeInTheDocument();
    });

    it('shows no description and no hint without a text', async () => {
      await build('boletus-edulis', false, { ...DESCRIBED, description: null, descriptionEn: '' });

      expect(screen.queryByText('Entwurf, nicht geprüft')).not.toBeInTheDocument();
    });
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
      'app-species-forecast',
      'app-species-senses',
      'app-species-hymenium',
      'app-species-lookalikes',
      'app-species-photos',
      'app-species-sources',
    ]);
  });

  it('links a species with a forecast to its map', async () => {
    await build();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    expect(screen.queryByText('Keine Vorhersage')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Auf der Karte anzeigen/ }));

    expect(TestBed.inject(MapStore).species()).toBe('boletus-edulis');
    expect(TestBed.inject(MapStore).view()).toBe('forecast');
    expect(navigate).toHaveBeenCalledWith('/karte');
  });

  it('shows a note and no map link for a species without a forecast', async () => {
    const container = await build('hydnum-repandum');

    expect(screen.getByText('Keine Vorhersage')).toBeInTheDocument();
    expect(screen.getByText(/Der Eintrag dient zum Nachschlagen/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Auf der Karte anzeigen/ })).toBeNull();
    await noViolations(container);
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
