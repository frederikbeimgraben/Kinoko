import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { ViewportService } from '../../core/layout/viewport.service';
import { noViolations } from '../../testing/axe';
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
    expect(order.slice(0, 4)).toEqual([
      'app-species-lead',
      'app-species-features',
      'app-species-taxonomy',
      'app-species-size',
    ]);
  });

  it('zeigt den Leerzustand zu einem unbekannten Slug', async () => {
    const container = await build('gibt-es-nicht');

    expect(screen.getByText('Art nicht gefunden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zur Liste' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('zeigt die Verwechslung mit einem eigenen Weg zum Vergleich', async () => {
    await build();

    expect(screen.getByRole('button', { name: 'Vergleichen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gallenröhrling' })).toBeInTheDocument();
  });

  it('stellt am Rechner zwei Spalten', async () => {
    const container = await build('boletus-edulis', true);

    expect(container.querySelector('.page--wide')).not.toBeNull();
  });
});
