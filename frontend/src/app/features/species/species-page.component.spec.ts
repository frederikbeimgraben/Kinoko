import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ViewportService } from '../../core/layout/viewport.service';
import { noViolations } from '../../testing/axe';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { catalogueProviders, catalogueReady } from '../../testing/catalogue-double';
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
  it('zeigt die Abschnitte des Katalogs', async () => {
    const container = await build();

    expect(screen.getByRole('heading', { name: 'Steinpilz' })).toBeInTheDocument();
    expect(container.querySelector('app-species-features')).not.toBeNull();
    expect(container.querySelector('app-species-size')).not.toBeNull();
    expect(container.querySelector('app-species-colours')).not.toBeNull();
    expect(container.querySelector('app-species-time')).not.toBeNull();
    expect(container.querySelector('app-species-photos')).not.toBeNull();
    await noViolations(container);
  });

  it('stellt die Abschnitte in der Folge der Boards', async () => {
    const container = await build();

    const order = [...container.querySelectorAll('.page > *')].map((one) => one.tagName.toLowerCase());
    expect(order).toEqual([
      'app-species-lead',
      'div',
      'app-species-features',
      'app-species-taxonomy',
      'app-species-size',
      'app-species-traits',
      'app-species-colours',
      'app-species-colour-change',
      'app-species-time',
      'app-species-senses',
      'app-species-hymenium',
      'app-species-lookalikes',
      'app-species-photos',
      'app-species-sources',
    ]);
  });

  it('zeigt den Leerzustand zu einem unbekannten Slug', async () => {
    const container = await build('gibt-es-nicht');

    expect(screen.getByText('Art nicht gefunden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zu allen Arten' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('zeigt die Verwechslung mit einem eigenen Weg zum Vergleich', async () => {
    await build();

    expect(screen.getAllByRole('button', { name: 'Vergleichen' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Gallenröhrling' })).toBeInTheDocument();
  });

  it('trägt den Kopf mit dem Vergleichen-Zeichen und dem Mehr-Knopf', async () => {
    await build();

    expect(screen.getByRole('button', { name: 'Mehr' })).toBeInTheDocument();
  });

  it('öffnet das Menü mit Teilen und Bild einreichen', async () => {
    await build();

    await userEvent.click(screen.getByRole('button', { name: 'Mehr' }));

    expect(screen.getByRole('button', { name: 'Teilen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bild einreichen' })).toBeInTheDocument();
  });

  it('stellt am Rechner zwei Spalten', async () => {
    const container = await build('boletus-edulis', true);

    expect(container.querySelector('.layout--columns')).not.toBeNull();
  });
});
