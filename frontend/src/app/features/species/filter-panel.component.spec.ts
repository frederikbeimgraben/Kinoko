import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { catalogueProviders, catalogueReady } from '../../testing/catalogue-double';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { speciesEntry, speciesBundle } from '../../testing/species-fixture';
import { SpeciesFilterPanelComponent } from './filter-panel.component';
import { SpeciesFilterState } from './filter.state';

const STEINPILZ = speciesEntry({
  slug: 'steinpilz',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  hymeniumType: 'tubes',
  colours: [{ part: 'cap', mode: 'single', colours: [{ name: 'braun', hex: '#6b4423' }] }],
});

const BUNDLE = speciesBundle([STEINPILZ]);

interface Setup {
  container: Element;
  filter: SpeciesFilterState;
}

async function build(): Promise<Setup> {
  const { container } = await render(SpeciesFilterPanelComponent, {
    providers: catalogueProviders(BUNDLE),
  });
  await catalogueReady();
  return { container, filter: TestBed.inject(SpeciesFilterState) };
}

describe('SpeciesFilterPanelComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('pilzkarte.speciesfilter');
  });

  it('zeigt die fünf Gruppen des Bretts flach in einer Spalte', async () => {
    const { container } = await build();

    expect(screen.getByRole('button', { name: 'Speisewert' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hutform' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fruchtschicht' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zeitraum' })).toBeInTheDocument();
    expect(container.querySelector('app-species-filter-colour')).not.toBeNull();
    await noViolations(container);
  });

  it('wählt einen Wert einer Gruppe über ihr Zeichen', async () => {
    const { filter } = await build();

    await userEvent.click(await screen.findByRole('button', { name: 'essbar' }));

    expect([...filter.chosenIn('edibility')]).toEqual(['edible']);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(SpeciesFilterPanelComponent, {
      providers: [...catalogueProviders(BUNDLE), EMPTY_CATALOG],
    });
    await catalogueReady();

    noGermanText(container);
  });
});
