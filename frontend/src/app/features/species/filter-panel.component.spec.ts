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

  it('zeigt die flachen Gruppen des Bretts, den Farbabschnitt eingerechnet', async () => {
    const { container } = await build();

    expect(screen.getByRole('button', { name: 'Speisewert' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hutform' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fruchtschicht' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abmessungen und Zeit' })).toBeInTheDocument();
    expect(container.querySelector('app-species-filter-colour')).not.toBeNull();
    await noViolations(container);
  });

  it('führt die übrigen Gruppen als Karten aus Zeilen', async () => {
    const { container } = await build();

    expect(container.querySelectorAll('.panel__card')).toHaveLength(2);
    expect(screen.getByText('Schutz')).toBeInTheDocument();
  });

  it('wählt einen Wert einer flachen Gruppe über ihr Zeichen', async () => {
    const { filter } = await build();

    await userEvent.click(await screen.findByRole('button', { name: 'essbar' }));

    expect([...filter.chosenIn('edibility')]).toEqual(['edible']);
  });

  it('öffnet eine übrige Gruppe aus ihrer Zeile', async () => {
    const { filter } = await build();

    await userEvent.click(screen.getByRole('button', { name: /Geruch/ }));

    expect(filter.group()).toBe('senses');
  });

  it('zeigt statt der Übersicht die gewählte Gruppe', async () => {
    const { container, filter } = await build();

    filter.showGroup('senses');
    await vi.waitFor(() => {
      expect(container.querySelector('app-species-filter-group')).not.toBeNull();
    });

    filter.showGroup('size');
    await vi.waitFor(() => {
      expect(container.querySelector('app-species-filter-size')).not.toBeNull();
    });
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(SpeciesFilterPanelComponent, {
      providers: [...catalogueProviders(BUNDLE), EMPTY_CATALOG],
    });
    await catalogueReady();

    noGermanText(container);
  });
});
