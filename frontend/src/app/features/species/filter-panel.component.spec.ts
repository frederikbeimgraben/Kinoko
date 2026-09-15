import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { catalogueProviders, catalogueReady } from '../../testing/catalogue-double';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { speciesEntry } from '../../testing/species-fixture';
import type { GroupKey } from './facets';
import { COLUMN_CARDS } from './filter-groups';
import { SpeciesFilterPanelComponent } from './filter-panel.component';
import { SpeciesFilterState } from './filter.state';

const STEINPILZ = speciesEntry({
  slug: 'steinpilz',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  hymeniumType: 'tubes',
  colours: [{ part: 'cap', mode: 'single', colours: [{ name: 'braun', hex: '#6b4423' }] }],
});

const BUNDLE = { items: [STEINPILZ] };

interface Setup {
  container: Element;
  filter: SpeciesFilterState;
}

async function build(groups?: readonly (readonly GroupKey[])[]): Promise<Setup> {
  const { container } = await render(SpeciesFilterPanelComponent, {
    inputs: groups ? { groups } : {},
    providers: catalogueProviders(BUNDLE),
  });
  await catalogueReady();
  return { container, filter: TestBed.inject(SpeciesFilterState) };
}

describe('SpeciesFilterPanelComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('pilzkarte.speciesfilter');
  });

  it('stellt die Übersicht als Karten aus Gruppenzeilen', async () => {
    const { container } = await build();

    expect(screen.getByText('Speisewert')).toBeInTheDocument();
    expect(screen.getByText('Fruchtschicht')).toBeInTheDocument();
    expect(screen.getByText('Farbe')).toBeInTheDocument();
    expect(container.querySelectorAll('.panel__card')).toHaveLength(3);
    await noViolations(container);
  });

  it('nimmt eine eigene Folge von Karten an', async () => {
    const { container } = await build(COLUMN_CARDS);

    expect(container.querySelectorAll('.panel__card')).toHaveLength(2);
    expect(screen.queryByText('Schutz')).not.toBeInTheDocument();
  });

  it('zeigt den einen gewählten Wert in der Zeile der Gruppe', async () => {
    const { filter } = await build();

    filter.toggle('hymenium', 'tubes');

    await vi.waitFor(() => {
      expect(screen.getByText('Röhren')).toBeInTheDocument();
    });
  });

  it('zählt die Werte, sobald mehr als einer gewählt ist', async () => {
    const { filter } = await build();

    filter.toggle('hymenium', 'tubes');
    filter.toggle('hymenium', 'gills');

    await vi.waitFor(() => {
      expect(screen.getByText('2 Werte')).toBeInTheDocument();
    });
  });

  it('zählt die Teile mit Farbe in der Zeile der Farbe', async () => {
    const { filter } = await build();

    filter.setColour('cap', '#6b4423');
    await vi.waitFor(() => {
      expect(screen.getByText('1 Teil')).toBeInTheDocument();
    });

    filter.setColour('stem', '#e8d9b5');
    await vi.waitFor(() => {
      expect(screen.getByText('2 Teile')).toBeInTheDocument();
    });
  });

  it('öffnet eine Gruppe aus ihrer Zeile', async () => {
    const { filter } = await build();

    await userEvent.click(screen.getByRole('button', { name: /Fruchtschicht/ }));

    expect(filter.group()).toBe('hymenium');
  });

  it('zeigt statt der Übersicht die gewählte Gruppe', async () => {
    const { container, filter } = await build();

    filter.showGroup('hymenium');
    await vi.waitFor(() => {
      expect(container.querySelector('app-species-group')).not.toBeNull();
    });

    filter.showGroup('colour');
    await vi.waitFor(() => {
      expect(container.querySelector('app-species-colour')).not.toBeNull();
    });

    filter.showGroup('size');
    await vi.waitFor(() => {
      expect(container.querySelector('app-species-size')).not.toBeNull();
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
